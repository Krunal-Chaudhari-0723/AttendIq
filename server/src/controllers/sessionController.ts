import { Response } from "express";
import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  CampusSettings,
  Class,
  ParticipationRecord,
  Student,
  Subject,
  ITeacher,
  Notification,
  VerificationAttempt,
} from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedTeacher } from "../utils/actor";
import { ATTENDANCE_CONFIG } from "../config/verification";
import { finalizeSession, refreshSessionStatuses } from "../services/sessionService";
import { notify } from "../services/notificationService";

/** Classes a teacher may run sessions for: class teacher, assigned, or teaches a subject there. */
export const getTeacherClassIds = async (teacher: ITeacher): Promise<mongoose.Types.ObjectId[]> => {
  const [classes, subjects] = await Promise.all([
    Class.find({ $or: [{ classTeacher: teacher._id }, { _id: { $in: teacher.assignedClasses } }] }).select("_id"),
    Subject.find({ teacherId: teacher._id }).select("classId"),
  ]);
  const ids = new Map<string, mongoose.Types.ObjectId>();
  for (const c of classes) ids.set(String(c._id), c._id as mongoose.Types.ObjectId);
  for (const s of subjects) ids.set(String(s.classId), s.classId);
  return [...ids.values()];
};

const requireTeacher = async (req: AuthenticatedRequest, res: Response) => {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) {
    sendResponse({ res, statusCode: 403, error: "Only teacher accounts can manage attendance sessions." });
    return null;
  }
  return teacher;
};

const serializeSession = (s: InstanceType<typeof AttendanceSession>) => ({
  id: s._id,
  classId: s.classId,
  className: s.className,
  division: s.division,
  subjectId: s.subjectId,
  subjectName: s.subjectName,
  teacherName: s.teacherName,
  mode: s.mode,
  room: s.room,
  status: s.status,
  startTime: s.startTime,
  endTime: s.endTime,
  durationMinutes: s.durationMinutes,
  lateAfterMinutes: s.lateAfterMinutes,
  endedAt: s.endedAt,
  endedBy: s.endedBy,
});

/**
 * @desc   Classes/subjects the teacher can start a session for, plus allowed modes
 * @route  GET /api/teacher/sessions/options
 */
export const getSessionOptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;

    const classIds = await getTeacherClassIds(teacher);
    const [classes, subjects, campus] = await Promise.all([
      Class.find({ _id: { $in: classIds }, isActive: true }).sort({ name: 1 }),
      Subject.find({ teacherId: teacher._id, classId: { $in: classIds } }).sort({ name: 1 }),
      CampusSettings.findOne().select("allowedModes isConfigured isEnforced defaultSessionMinutes defaultLateAfterMinutes"),
    ]);

    return sendResponse({
      res,
      data: {
        classes: classes.map((c) => ({ id: c._id, name: c.name, code: c.code, division: c.division, studentCount: c.studentCount })),
        subjects: subjects.map((s) => ({ id: s._id, name: s.name, code: s.code, classId: s.classId })),
        allowedModes: campus?.allowedModes ?? ["PHYSICAL", "REMOTE"],
        campusConfigured: Boolean(campus?.isConfigured),
        locationEnforced: campus?.isEnforced ?? true,
        limits: {
          defaultMinutes: campus?.defaultSessionMinutes ?? ATTENDANCE_CONFIG.defaultSessionMinutes,
          minMinutes: ATTENDANCE_CONFIG.minSessionMinutes,
          maxMinutes: ATTENDANCE_CONFIG.maxSessionMinutes,
          defaultLateAfterMinutes: campus?.defaultLateAfterMinutes ?? ATTENDANCE_CONFIG.defaultLateAfterMinutes,
        },
      },
    });
  } catch (error) {
    console.error("[Session API] options:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load session options" });
  }
};

/**
 * @desc   Start (or schedule) an attendance session
 * @route  POST /api/teacher/sessions
 * @body   { classId, subjectId, mode, durationMinutes, startAt?, lateAfterMinutes?, room? }
 */
export const startSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;

    const { classId, subjectId, mode, durationMinutes, startAt, lateAfterMinutes, room } = req.body ?? {};

    if (!mongoose.Types.ObjectId.isValid(String(classId)) || !mongoose.Types.ObjectId.isValid(String(subjectId))) {
      return sendResponse({ res, statusCode: 400, error: "Valid classId and subjectId are required." });
    }
    if (mode !== "PHYSICAL" && mode !== "REMOTE") {
      return sendResponse({ res, statusCode: 400, error: "mode must be PHYSICAL or REMOTE." });
    }
    const defaults = await CampusSettings.findOne().select("defaultSessionMinutes defaultLateAfterMinutes");
    const minutes = Number(durationMinutes ?? defaults?.defaultSessionMinutes ?? ATTENDANCE_CONFIG.defaultSessionMinutes);
    if (!Number.isInteger(minutes) || minutes < ATTENDANCE_CONFIG.minSessionMinutes || minutes > ATTENDANCE_CONFIG.maxSessionMinutes) {
      return sendResponse({
        res,
        statusCode: 400,
        error: `durationMinutes must be a whole number between ${ATTENDANCE_CONFIG.minSessionMinutes} and ${ATTENDANCE_CONFIG.maxSessionMinutes}.`,
      });
    }
    const late = Number(lateAfterMinutes ?? Math.min(defaults?.defaultLateAfterMinutes ?? ATTENDANCE_CONFIG.defaultLateAfterMinutes, minutes));
    if (!Number.isInteger(late) || late < 0 || late > minutes) {
      return sendResponse({ res, statusCode: 400, error: "lateAfterMinutes must be between 0 and the session duration." });
    }

    const now = new Date();
    let start = now;
    if (startAt) {
      start = new Date(startAt);
      if (Number.isNaN(start.getTime())) return sendResponse({ res, statusCode: 400, error: "startAt is not a valid date." });
      if (start.getTime() < now.getTime() - 60_000) {
        return sendResponse({ res, statusCode: 400, error: "startAt cannot be in the past." });
      }
      if (start.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) {
        return sendResponse({ res, statusCode: 400, error: "Sessions can be scheduled at most 7 days ahead." });
      }
      if (start < now) start = now;
    }
    const end = new Date(start.getTime() + minutes * 60_000);

    // Authorization: teacher must be linked to the class AND teach this subject in that class
    const allowedClassIds = (await getTeacherClassIds(teacher)).map(String);
    if (!allowedClassIds.includes(String(classId))) {
      return sendResponse({ res, statusCode: 403, error: "You are not assigned to this class." });
    }
    const [cls, subject, campus] = await Promise.all([
      Class.findById(classId),
      Subject.findById(subjectId),
      CampusSettings.findOne(),
    ]);
    if (!cls || !cls.isActive) return sendResponse({ res, statusCode: 404, error: "Class not found or inactive." });
    if (!subject || !subject.classId.equals(cls._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 400, error: "Subject does not belong to the selected class." });
    }
    if (!subject.teacherId || !subject.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You do not teach this subject." });
    }
    if (campus && !campus.allowedModes.includes(mode)) {
      return sendResponse({ res, statusCode: 400, error: `${mode} attendance is disabled in campus settings.` });
    }

    // Prevent overlapping sessions for the same class
    await refreshSessionStatuses({ classId: cls._id });
    const overlapping = await AttendanceSession.findOne({
      classId: cls._id,
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
    if (overlapping) {
      return sendResponse({
        res,
        statusCode: 409,
        error: `${cls.name} already has a ${overlapping.status.toLowerCase()} session (${overlapping.subjectName}) in this time window.`,
      });
    }

    const isNow = start.getTime() <= now.getTime() + 1000;
    const session = await AttendanceSession.create({
      classId: cls._id,
      className: cls.name,
      division: cls.division,
      subjectId: subject._id,
      subjectName: subject.name,
      teacherId: teacher._id,
      teacherName: teacher.name,
      mode,
      room: typeof room === "string" ? room.trim().slice(0, 60) || undefined : undefined,
      startTime: start,
      endTime: end,
      durationMinutes: minutes,
      lateAfterMinutes: late,
      status: isNow ? "ACTIVE" : "SCHEDULED",
      isActive: isNow,
    });

    await notify({
      recipientRole: "STUDENT",
      recipientId: `CLASS:${cls._id}`,
      link: "/student/live-attendance",
      dedupeKey: `SESSION:${session._id}`,
      title: isNow ? `Attendance open: ${subject.name}` : `Session scheduled: ${subject.name}`,
      message: isNow
        ? `${teacher.name} opened ${mode.toLowerCase()} attendance for ${cls.name} until ${end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`
        : `${teacher.name} scheduled ${mode.toLowerCase()} attendance for ${cls.name} at ${start.toLocaleString("en-IN")}.`,
      type: "SESSION",
      metadata: { sessionId: String(session._id), classId: String(cls._id) },
    });

    return sendResponse({
      res,
      statusCode: 201,
      message: isNow ? "Attendance session is now ACTIVE." : "Attendance session scheduled.",
      data: serializeSession(session),
    });
  } catch (error) {
    console.error("[Session API] start:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to start attendance session" });
  }
};

/**
 * @desc   End a session now. Students without a verified record are marked ABSENT.
 * @route  POST /api/teacher/sessions/:id/end
 */
export const endSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Session not found" });

    const session = await AttendanceSession.findById(req.params.id);
    if (!session) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    if (!session.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You can only end your own sessions." });
    }
    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return sendResponse({ res, statusCode: 409, error: `Session is already ${session.status.toLowerCase()}.` });
    }

    if (session.status === "SCHEDULED" && session.startTime > new Date()) {
      session.status = "CANCELLED";
      session.isActive = false;
      session.endedAt = new Date();
      session.endedBy = "TEACHER";
      await session.save();
      return sendResponse({ res, message: "Scheduled session cancelled.", data: serializeSession(session) });
    }

    const { absentCount } = await finalizeSession(session, "TEACHER");
    return sendResponse({
      res,
      message: `Session ended. ${absentCount} student(s) without verified attendance were marked absent.`,
      data: { ...serializeSession(session), absentCount },
    });
  } catch (error) {
    console.error("[Session API] end:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to end session" });
  }
};

const EVENT_LABELS: Record<string, string> = {
  OUTSIDE_RADIUS: "Rejected: outside campus radius",
  LOCATION_IMPRECISE: "Rejected: location too imprecise",
  LOCATION_REQUIRED: "Rejected: no location shared",
  CAMPUS_NOT_CONFIGURED: "Rejected: campus not configured",
  ENROLLMENT_MISSING: "Rejected: face not enrolled",
  FACE_MISMATCH: "Rejected: face did not match",
  LIVENESS_FAILED: "Rejected: liveness check failed",
  INVALID_DESCRIPTOR: "Rejected: invalid face data",
  SESSION_EXPIRED: "Rejected: session had ended",
  SESSION_INACTIVE: "Rejected: session not active",
  DUPLICATE_ATTENDANCE: "Duplicate attempt (already marked)",
  ATTEMPT_EXPIRED: "Verification timed out",
  CAMERA_DENIED: "Camera permission denied",
  CAMERA_UNAVAILABLE: "Camera unavailable",
  NO_FACE: "No face detected",
  MULTIPLE_FACES: "Multiple faces detected",
  POOR_QUALITY: "Could not capture a clear face",
  CANCELLED: "Cancelled by student",
  SUPERSEDED: "Restarted by student",
  MODE_NOT_ALLOWED: "Rejected: mode disabled",
  WRONG_CLASS: "Rejected: not in this class",
  PROCESSING_FAILURE: "Device processing failure",
};

/**
 * @desc   Live monitor: roster with verification status, counts and recent verification events.
 *         Contains no biometric data and no coordinates.
 * @route  GET /api/teacher/sessions/:id/live
 */
export const getSessionLive = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    await refreshSessionStatuses({ _id: new mongoose.Types.ObjectId(req.params.id) });
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    if (!session.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You can only monitor your own sessions." });
    }

    const [students, records, attempts, ratings] = await Promise.all([
      Student.find({ classId: session.classId, status: "ACTIVE" }).select("studentId name rollNumber isFaceEnrolled").sort({ studentId: 1 }),
      AttendanceRecord.find({ sessionId: session._id }),
      VerificationAttempt.find({ sessionId: session._id, status: { $ne: "PENDING" } }).sort({ updatedAt: -1 }).limit(40),
      ParticipationRecord.find({ sessionId: session._id }).select("studentId rating"),
    ]);
    const pending = await VerificationAttempt.find({ sessionId: session._id, status: "PENDING", expiresAt: { $gt: new Date() } }).select("studentId stage");
    const recordMap = new Map(records.map((r) => [r.studentId, r]));
    const pendingMap = new Map(pending.map((p) => [p.studentId, p.stage]));
    const ratingMap = new Map(ratings.map((r) => [r.studentId, r.rating]));
    const failuresByStudent = new Map<string, number>();
    for (const a of attempts) if (a.status === "FAILED") failuresByStudent.set(a.studentId, (failuresByStudent.get(a.studentId) || 0) + 1);

    const roster = students.map((s) => {
      const r = recordMap.get(s.studentId);
      return {
        studentId: s.studentId,
        name: s.name,
        rollNumber: s.rollNumber,
        faceEnrolled: s.isFaceEnrolled,
        status: r ? r.status : pendingMap.has(s.studentId) ? "VERIFYING" : "NOT_MARKED",
        markedAt: r?.markedAt ?? null,
        verificationMethod: r?.verificationMethod ?? null,
        confidence: r && r.confidence > 0 ? r.confidence : null,
        distanceMeters: r?.verificationMetadata?.distanceMeters ?? null,
        livenessVerified: r?.livenessVerified ?? false,
        note: r?.verificationMetadata?.note ?? null,
        failedAttempts: failuresByStudent.get(s.studentId) || 0,
        participation: ratingMap.has(s.studentId) ? ratingMap.get(s.studentId) : null,
      };
    });
    const count = (st: string) => roster.filter((r) => r.status === st).length;
    const verified = records.filter((r) => r.confidence > 0);
    const studentNames = new Map(students.map((s) => [s.studentId, s.name]));

    return sendResponse({
      res,
      data: {
        session: serializeSession(session),
        serverTime: new Date(),
        counts: {
          total: roster.length,
          present: count("PRESENT"),
          late: count("LATE"),
          excused: count("EXCUSED"),
          absent: count("ABSENT"),
          verifying: count("VERIFYING"),
          notMarked: count("NOT_MARKED"),
          notEnrolled: roster.filter((r) => !r.faceEnrolled).length,
          averageConfidence: verified.length ? Math.round((verified.reduce((s, r) => s + r.confidence, 0) / verified.length) * 100) / 100 : null,
        },
        roster,
        events: attempts.map((a) => ({
          id: a._id,
          studentId: a.studentId,
          studentName: studentNames.get(a.studentId) ?? a.studentName,
          status: a.status,
          code: a.failureCode ?? null,
          label: a.status === "SUCCEEDED" ? "Verified: face + liveness" + (a.location?.checked ? " + location" : "") : EVENT_LABELS[a.failureCode || ""] ?? a.message ?? "Failed",
          detail: a.status === "FAILED" ? a.message ?? null : null,
          confidence: a.confidence ?? null,
          distanceMeters: a.location?.checked ? a.location.distanceMeters ?? null : null,
          at: a.completedAt ?? a.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("[Session API] live:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load live session" });
  }
};

/**
 * @desc   Manual override by the session's teacher (e.g. a student's device failed).
 *         Always recorded as MANUAL with the teacher's reason — never as a biometric verification.
 * @route  POST /api/teacher/sessions/:id/manual  { studentId, status: "PRESENT"|"LATE"|"EXCUSED"|"ABSENT", reason }
 */
export const manualMark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    if (!session.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You can only update your own sessions." });
    }
    const { studentId, status, reason } = req.body ?? {};
    if (!["PRESENT", "LATE", "EXCUSED", "ABSENT"].includes(status)) {
      return sendResponse({ res, statusCode: 400, error: "status must be PRESENT, LATE, EXCUSED or ABSENT." });
    }
    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 200) : "";
    if (cleanReason.length < 5) return sendResponse({ res, statusCode: 400, error: "A reason (at least 5 characters) is required for manual changes." });
    const student = await Student.findOne({ studentId: String(studentId || "").toUpperCase(), classId: session.classId });
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student is not in this session's class." });

    const existing = await AttendanceRecord.findOne({ sessionId: session._id, studentId: student.studentId });
    if (existing && existing.markedBy === "STUDENT") {
      return sendResponse({ res, statusCode: 409, error: "This student already verified with face and liveness; that record cannot be overwritten." });
    }
    await AttendanceRecord.findOneAndUpdate(
      { sessionId: session._id, studentId: student.studentId },
      {
        $set: {
          student: student._id,
          status,
          verificationMethod: "MANUAL",
          confidence: 0,
          livenessVerified: false,
          locationVerified: false,
          "verificationMetadata.note": `Manual (${teacher.name}): ${cleanReason}`,
          markedAt: new Date(),
          markedBy: "TEACHER",
        },
      },
      { upsert: true }
    );
    return sendResponse({ res, message: `${student.name} marked ${status} manually.` });
  } catch (error) {
    console.error("[Session API] manual:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to update attendance" });
  }
};

/**
 * @desc   Teacher's sessions (active/scheduled first, then recent)
 * @route  GET /api/teacher/sessions?status=ACTIVE|SCHEDULED|COMPLETED&limit=20
 */
export const listSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    await refreshSessionStatuses({ teacherId: teacher._id });

    const filter: Record<string, unknown> = { teacherId: teacher._id };
    const status = String(req.query.status || "");
    if (["ACTIVE", "SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) filter.status = status;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const sessions = await AttendanceSession.find(filter).sort({ startTime: -1 }).limit(limit);
    return sendResponse({ res, data: { sessions: sessions.map(serializeSession) } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to load sessions" });
  }
};
