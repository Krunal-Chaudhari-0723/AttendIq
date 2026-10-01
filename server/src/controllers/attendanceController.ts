import { Response } from "express";
import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  CampusSettings,
  FaceProfile,
  VerificationAttempt,
  IAttendanceSession,
  IStudent,
  AttemptFailureCode,
  LivenessChallenge,
} from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent } from "../utils/actor";
import { ATTENDANCE_CONFIG, LIVENESS_CONFIG } from "../config/verification";
import { findOpenSessionForClass, isSessionOpen, refreshSessionStatuses } from "../services/sessionService";
import { haversineDistanceMeters, parseLocation } from "../services/geoService";
import { evaluateLiveness, parseFrames } from "../services/livenessService";
import { compareWithEnrollment, euclideanDistance, parseDescriptor } from "../services/faceService";
import { loadEnrolledDescriptor } from "./faceController";
import { notifyAttendanceMarked } from "../services/notificationService";

const FAILURE_MESSAGES: Partial<Record<AttemptFailureCode, string>> = {
  SESSION_NOT_FOUND: "Attendance session not found.",
  WRONG_CLASS: "This session is not for your class.",
  SESSION_INACTIVE: "This attendance session is not active.",
  SESSION_EXPIRED: "This attendance session has ended.",
  DUPLICATE_ATTENDANCE: "Your attendance is already recorded for this session.",
  ENROLLMENT_MISSING: "Face enrollment is required before marking attendance.",
  STUDENT_INACTIVE: "Your student account is not active. Contact your administrator.",
  MODE_NOT_ALLOWED: "This attendance mode is currently disabled by the institution.",
  CAMPUS_NOT_CONFIGURED: "Campus location has not been configured by the administrator yet.",
  LOCATION_REQUIRED: "Your location is required for physical attendance.",
  LOCATION_IMPRECISE: "Your location fix is too imprecise. Move near a window or enable precise location and retry.",
  OUTSIDE_RADIUS: "You appear to be outside the campus attendance radius.",
  CAMERA_DENIED: "Camera permission was denied.",
  CAMERA_UNAVAILABLE: "Camera was not available.",
  NO_FACE: "No face was detected.",
  MULTIPLE_FACES: "Multiple faces were detected.",
  POOR_QUALITY: "Camera image quality was too poor.",
  CANCELLED: "Verification was cancelled.",
  LIVENESS_FAILED: "Liveness check was not completed.",
  PROCESSING_FAILURE: "Face processing failed on the device.",
};

/** Client-reported reasons a student may abort an attempt with (cannot mark anything as success). */
const CLIENT_ABORT_CODES: AttemptFailureCode[] = [
  "LIVENESS_FAILED",
  "CAMERA_DENIED",
  "CAMERA_UNAVAILABLE",
  "NO_FACE",
  "MULTIPLE_FACES",
  "POOR_QUALITY",
  "CANCELLED",
  "PROCESSING_FAILURE",
];

const STATUS_FOR_CODE: Partial<Record<AttemptFailureCode, number>> = {
  SESSION_NOT_FOUND: 404,
  WRONG_CLASS: 403,
  STUDENT_INACTIVE: 403,
  DUPLICATE_ATTENDANCE: 409,
  ENROLLMENT_MISSING: 409,
  CAMPUS_NOT_CONFIGURED: 503,
};

export const failure = (res: Response, code: AttemptFailureCode, extra: Record<string, unknown> = {}, message?: string) =>
  sendResponse({
    res,
    statusCode: STATUS_FOR_CODE[code] ?? 422,
    error: message || FAILURE_MESSAGES[code] || "Attendance verification failed.",
    data: { code, ...extra },
  });

/** Persist a failed attempt so teachers can see rejected verifications (no coordinates/biometrics). */
const logFailedAttempt = async (
  student: IStudent,
  session: IAttendanceSession,
  stage: "SESSION" | "LOCATION",
  code: AttemptFailureCode,
  location?: Record<string, unknown>
) => {
  await VerificationAttempt.create({
    sessionId: session._id,
    student: student._id,
    studentId: student.studentId,
    studentName: student.name,
    mode: session.mode,
    status: "FAILED",
    stage,
    failureCode: code,
    message: FAILURE_MESSAGES[code],
    location,
    expiresAt: new Date(),
    completedAt: new Date(),
  });
};

const pickChallenge = (): LivenessChallenge => (Math.random() < 0.5 ? "TURN_LEFT" : "TURN_RIGHT");

/**
 * @desc   The open attendance session for the signed-in student's class (if any) and readiness flags
 * @route  GET /api/student/attendance/session
 */
export const getOpenSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });

    const [session, faceProfile, campus] = await Promise.all([
      findOpenSessionForClass(student.classId),
      FaceProfile.exists({ studentId: student.studentId, isActive: true }),
      CampusSettings.findOne().select("isConfigured isEnforced radiusMeters campusName allowedModes"),
    ]);

    const record = session
      ? await AttendanceRecord.findOne({ sessionId: session._id, studentId: student.studentId }).select(
          "status markedAt verificationMethod confidence"
        )
      : null;

    return sendResponse({
      res,
      data: {
        faceEnrolled: Boolean(faceProfile),
        campus: {
          name: campus?.campusName ?? null,
          configured: Boolean(campus?.isConfigured),
          enforced: campus?.isEnforced ?? true,
          radiusMeters: campus?.radiusMeters ?? null,
        },
        session: session
          ? {
              id: session._id,
              subjectName: session.subjectName,
              className: session.className,
              division: session.division,
              teacherName: session.teacherName,
              mode: session.mode,
              room: session.room,
              startTime: session.startTime,
              endTime: session.endTime,
              lateAfterMinutes: session.lateAfterMinutes,
              requiresLocation: session.mode === "PHYSICAL" && (campus?.isEnforced ?? true),
            }
          : null,
        record: record
          ? {
              status: record.status,
              markedAt: record.markedAt,
              verificationMethod: record.verificationMethod,
              confidence: record.confidence,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[Attendance API] getOpenSession:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load attendance session" });
  }
};

/**
 * @desc   Step 1 of marking attendance: session + location verification.
 *         On success returns an attempt id and a random liveness challenge for the camera step.
 * @route  POST /api/student/attendance/precheck
 * @body   { sessionId, location?: { latitude, longitude, accuracy } }
 */
export const precheckAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    if (student.status !== "ACTIVE") return failure(res, "STUDENT_INACTIVE");

    const { sessionId } = req.body ?? {};
    if (!sessionId || !mongoose.Types.ObjectId.isValid(String(sessionId))) {
      return failure(res, "SESSION_NOT_FOUND");
    }

    await refreshSessionStatuses({ _id: new mongoose.Types.ObjectId(String(sessionId)) });
    const session = await AttendanceSession.findById(sessionId);
    if (!session) return failure(res, "SESSION_NOT_FOUND");

    // Class authorization: the session must belong to the student's own class
    if (!student.classId || !session.classId.equals(student.classId)) {
      return failure(res, "WRONG_CLASS");
    }

    if (!isSessionOpen(session)) {
      const code: AttemptFailureCode = session.status === "COMPLETED" || session.endTime <= new Date() ? "SESSION_EXPIRED" : "SESSION_INACTIVE";
      await logFailedAttempt(student, session, "SESSION", code);
      return failure(res, code);
    }

    if (await AttendanceRecord.exists({ sessionId: session._id, studentId: student.studentId })) {
      return failure(res, "DUPLICATE_ATTENDANCE");
    }

    if (!(await FaceProfile.exists({ studentId: student.studentId, isActive: true }))) {
      await logFailedAttempt(student, session, "SESSION", "ENROLLMENT_MISSING");
      return failure(res, "ENROLLMENT_MISSING");
    }

    const campus = await CampusSettings.findOne();
    if (campus && !campus.allowedModes.includes(session.mode)) {
      await logFailedAttempt(student, session, "SESSION", "MODE_NOT_ALLOWED");
      return failure(res, "MODE_NOT_ALLOWED");
    }

    // ---- Location verification (PHYSICAL sessions only; the server computes the distance) ----
    let locationResult: Record<string, unknown> = { checked: false };
    const enforceLocation = session.mode === "PHYSICAL" && (campus?.isEnforced ?? true);

    if (enforceLocation) {
      if (!campus || !campus.isConfigured) {
        await logFailedAttempt(student, session, "LOCATION", "CAMPUS_NOT_CONFIGURED");
        return failure(res, "CAMPUS_NOT_CONFIGURED");
      }
      const location = parseLocation(req.body?.location);
      if (!location) {
        await logFailedAttempt(student, session, "LOCATION", "LOCATION_REQUIRED");
        return failure(res, "LOCATION_REQUIRED");
      }

      const distance = Math.round(
        haversineDistanceMeters(location.latitude, location.longitude, campus.latitude, campus.longitude)
      );
      const accuracy = Math.round(location.accuracy);
      locationResult = {
        checked: true,
        distanceMeters: distance,
        accuracyMeters: accuracy,
        radiusMeters: campus.radiusMeters,
        withinRadius: distance <= campus.radiusMeters,
      };

      if (accuracy > campus.maxAccuracyMeters) {
        await logFailedAttempt(student, session, "LOCATION", "LOCATION_IMPRECISE", locationResult);
        return failure(res, "LOCATION_IMPRECISE", {
          location: { accuracyMeters: accuracy, maxAccuracyMeters: campus.maxAccuracyMeters },
        });
      }
      if (distance > campus.radiusMeters) {
        await logFailedAttempt(student, session, "LOCATION", "OUTSIDE_RADIUS", locationResult);
        return failure(
          res,
          "OUTSIDE_RADIUS",
          { location: { distanceMeters: distance, radiusMeters: campus.radiusMeters } },
          `You are about ${distance} m from campus; attendance is allowed within ${campus.radiusMeters} m.`
        );
      }
    }

    // Only one live attempt per student per session
    await VerificationAttempt.updateMany(
      { student: student._id, sessionId: session._id, status: "PENDING" },
      { $set: { status: "FAILED", failureCode: "SUPERSEDED", completedAt: new Date() } }
    );

    const attempt = await VerificationAttempt.create({
      sessionId: session._id,
      student: student._id,
      studentId: student.studentId,
      studentName: student.name,
      mode: session.mode,
      status: "PENDING",
      stage: "FACE",
      challenge: pickChallenge(),
      location: locationResult,
      expiresAt: new Date(Date.now() + ATTENDANCE_CONFIG.attemptTtlMs),
    });

    return sendResponse({
      res,
      message: enforceLocation ? "Location verified. Continue with face verification." : "Session verified. Continue with face verification.",
      data: {
        attemptId: attempt._id,
        challenge: attempt.challenge,
        expiresAt: attempt.expiresAt,
        location: enforceLocation
          ? { verified: true, distanceMeters: locationResult.distanceMeters, radiusMeters: locationResult.radiusMeters }
          : { verified: false, skipped: true },
      },
    });
  } catch (error) {
    console.error("[Attendance API] precheck:", error);
    return sendResponse({ res, statusCode: 500, error: "Attendance pre-check failed", data: { code: "PROCESSING_FAILURE" } });
  }
};

/**
 * @desc   Client reports why the camera step could not complete (e.g. camera denied).
 *         Can only move an attempt to FAILED — never to success.
 * @route  POST /api/student/attendance/attempts/:id/abort
 */
export const abortAttempt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Attempt not found" });

    const code = String(req.body?.code || "CANCELLED") as AttemptFailureCode;
    const safeCode = CLIENT_ABORT_CODES.includes(code) ? code : "CANCELLED";

    const attempt = await VerificationAttempt.findOneAndUpdate(
      { _id: req.params.id, student: student._id, status: "PENDING" },
      { $set: { status: "FAILED", failureCode: safeCode, message: FAILURE_MESSAGES[safeCode], completedAt: new Date() } },
      { new: true }
    );
    if (!attempt) return sendResponse({ res, statusCode: 404, error: "Attempt not found or already finished" });
    return sendResponse({ res, message: "Attempt closed", data: { code: safeCode } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to close attempt" });
  }
};

/**
 * @desc   Final step: liveness + face identity, then create the attendance record.
 *         Every check is repeated server-side; nothing the client claims about the result is trusted.
 * @route  POST /api/student/attendance/verify
 * @body   { attemptId, liveness: { frames: [{ t, yaw, faces }] },
 *           descriptors: { start: number[128], peak: number[128], end: number[128] } }
 */
export const verifyAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });

    const { attemptId } = req.body ?? {};
    if (!attemptId || !mongoose.Types.ObjectId.isValid(String(attemptId))) {
      return failure(res, "ATTEMPT_EXPIRED", {}, "Verification attempt not found. Please start again.");
    }

    // The attempt must belong to this student and still be pending; claim it atomically so it is single-use
    const attempt = await VerificationAttempt.findOneAndUpdate(
      { _id: attemptId, student: student._id, status: "PENDING", stage: "FACE" },
      { $set: { stage: "LIVENESS" } },
      { new: true }
    );
    if (!attempt) {
      return failure(res, "ATTEMPT_EXPIRED", {}, "Verification attempt not found or already used. Please start again.");
    }

    const closeAttempt = async (code: AttemptFailureCode, message: string, extra: Record<string, unknown> = {}) => {
      await VerificationAttempt.updateOne(
        { _id: attempt._id },
        {
          $set: {
            status: code === "ATTEMPT_EXPIRED" ? "EXPIRED" : "FAILED",
            failureCode: code,
            message,
            completedAt: new Date(),
            ...extra,
          },
        }
      );
      return failure(res, code, extra, message);
    };

    if (attempt.expiresAt.getTime() < Date.now()) {
      return closeAttempt("ATTEMPT_EXPIRED", "Verification took too long. Please start again.");
    }

    // Re-validate the session window and class at the moment of marking
    await refreshSessionStatuses({ _id: attempt.sessionId });
    const session = await AttendanceSession.findById(attempt.sessionId);
    if (!session || !student.classId || !session.classId.equals(student.classId)) {
      return closeAttempt("WRONG_CLASS", FAILURE_MESSAGES.WRONG_CLASS!);
    }
    if (!isSessionOpen(session)) {
      return closeAttempt("SESSION_EXPIRED", FAILURE_MESSAGES.SESSION_EXPIRED!);
    }
    if (await AttendanceRecord.exists({ sessionId: session._id, studentId: student.studentId })) {
      return closeAttempt("DUPLICATE_ATTENDANCE", FAILURE_MESSAGES.DUPLICATE_ATTENDANCE!);
    }

    // ---- Liveness ----
    const frames = parseFrames(req.body?.liveness?.frames);
    if (!frames) return closeAttempt("LIVENESS_FAILED", "Liveness data was missing or invalid.", { livenessPassed: false });
    const liveness = evaluateLiveness(attempt.challenge!, frames, Date.now() - attempt.createdAt.getTime());
    if (!liveness.passed) {
      return closeAttempt("LIVENESS_FAILED", liveness.reason, { livenessPassed: false });
    }

    // ---- Face identity (server-side comparison against the encrypted enrollment) ----
    let start: number[], peak: number[], end: number[];
    try {
      start = parseDescriptor(req.body?.descriptors?.start);
      peak = parseDescriptor(req.body?.descriptors?.peak);
      end = parseDescriptor(req.body?.descriptors?.end);
    } catch {
      return closeAttempt("INVALID_DESCRIPTOR", "Face data was missing or invalid.", { livenessPassed: true });
    }
    const enrolled = await loadEnrolledDescriptor(student.studentId);
    if (!enrolled) return closeAttempt("ENROLLMENT_MISSING", FAILURE_MESSAGES.ENROLLMENT_MISSING!);

    // The same person must be present before, during and after the head turn
    if (euclideanDistance(start, end) > LIVENESS_CONFIG.startEndMaxDistance) {
      return closeAttempt("LIVENESS_FAILED", "A different face appeared during the check.", { livenessPassed: false });
    }
    const startMatch = compareWithEnrollment(start, enrolled);
    const endMatch = compareWithEnrollment(end, enrolled);
    const peakDistance = euclideanDistance(peak, enrolled);
    const confidence = Math.round(((startMatch.confidence + endMatch.confidence) / 2) * 100) / 100;

    if (!startMatch.matched || !endMatch.matched || peakDistance > LIVENESS_CONFIG.peakMaxDistance) {
      return closeAttempt("FACE_MISMATCH", "Your face did not match your enrolled face profile.", {
        livenessPassed: true,
        confidence,
      });
    }

    // ---- All layers passed: create the record ----
    const now = new Date();
    const lateCutoff = new Date(session.startTime.getTime() + session.lateAfterMinutes * 60_000);
    const status = now > lateCutoff ? "LATE" : "PRESENT";
    const locationChecked = Boolean(attempt.location?.checked);
    const verificationMethod =
      session.mode === "REMOTE" ? "REMOTE_FACE" : locationChecked ? "FACE_AND_LOCATION" : "FACE_ONLY";

    try {
      await AttendanceRecord.create({
        sessionId: session._id,
        studentId: student.studentId,
        student: student._id,
        status,
        verificationMethod,
        confidence,
        livenessVerified: true,
        locationVerified: locationChecked,
        verificationMetadata: {
          distanceMeters: attempt.location?.distanceMeters,
          withinRadius: attempt.location?.withinRadius,
          accuracyMeters: attempt.location?.accuracyMeters,
          attemptId: attempt._id,
          challenge: attempt.challenge,
        },
        markedAt: now,
        markedBy: "STUDENT",
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        return closeAttempt("DUPLICATE_ATTENDANCE", FAILURE_MESSAGES.DUPLICATE_ATTENDANCE!);
      }
      throw error;
    }

    await VerificationAttempt.updateOne(
      { _id: attempt._id },
      { $set: { status: "SUCCEEDED", stage: "COMPLETE", confidence, livenessPassed: true, completedAt: now } }
    );
    void notifyAttendanceMarked(student, session.subjectName, status, String(session._id));

    return sendResponse({
      res,
      statusCode: 201,
      message: `Attendance marked: ${status}`,
      data: {
        status,
        subjectName: session.subjectName,
        markedAt: now,
        verificationMethod,
        matched: true,
        confidence,
        liveness: { passed: true, challenge: attempt.challenge },
        location: locationChecked
          ? { verified: true, distanceMeters: attempt.location?.distanceMeters, radiusMeters: attempt.location?.radiusMeters }
          : { verified: false },
      },
    });
  } catch (error) {
    console.error("[Attendance API] verify:", error);
    return sendResponse({ res, statusCode: 500, error: "Attendance verification failed", data: { code: "PROCESSING_FAILURE" } });
  }
};
