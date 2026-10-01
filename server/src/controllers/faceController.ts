import { Response } from "express";
import { FaceProfile, Student } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent } from "../utils/actor";
import { FACE_CONFIG } from "../config/verification";
import {
  FaceError,
  buildEnrollmentDescriptor,
  compareWithEnrollment,
  decryptEmbedding,
  encryptEmbedding,
  parseDescriptor,
} from "../services/faceService";

const studentNotFound = (res: Response) =>
  sendResponse({ res, statusCode: 404, error: "Student profile not found for this account." });

const handleFaceError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof FaceError) {
    return sendResponse({ res, statusCode: error.statusCode, error: error.message, data: { code: error.code } });
  }
  console.error(`[Face API] ${fallback}:`, error);
  return sendResponse({ res, statusCode: 500, error: fallback, data: { code: "PROCESSING_FAILURE" } });
};

/**
 * Load and decrypt the enrolled descriptor for a student (server-side only).
 */
export const loadEnrolledDescriptor = async (studentId: string): Promise<number[] | null> => {
  const profile = await FaceProfile.findOne({ studentId, isActive: true }).select("+embeddingEncrypted");
  if (!profile?.embeddingEncrypted) return null;
  return decryptEmbedding(profile.embeddingEncrypted);
};

/**
 * @desc   Face enrollment status for the signed-in student (no biometric data returned)
 * @route  GET /api/student/face/status
 */
export const getFaceStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return studentNotFound(res);

    const profile = await FaceProfile.findOne({ studentId: student.studentId, isActive: true });
    return sendResponse({
      res,
      data: {
        enrolled: Boolean(profile),
        enrolledAt: profile?.enrolledAt ?? null,
        updatedAt: profile?.updatedAt ?? null,
        modelVersion: profile?.modelVersion ?? null,
        sampleCount: profile?.sampleCount ?? 0,
        expectedModelVersion: FACE_CONFIG.modelVersion,
      },
    });
  } catch (error) {
    return handleFaceError(res, error, "Failed to load face enrollment status");
  }
};

/**
 * @desc   One-time face enrollment. Re-enrollment requires an admin to purge the old profile.
 * @route  POST /api/student/face/enroll
 * @body   { samples: number[][], modelVersion: string }
 */
export const enrollFace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return studentNotFound(res);

    if (req.body?.modelVersion !== FACE_CONFIG.modelVersion) {
      return sendResponse({
        res,
        statusCode: 400,
        error: "Face model version mismatch. Please refresh the page and try again.",
        data: { code: "MODEL_VERSION_MISMATCH" },
      });
    }

    const existing = await FaceProfile.findOne({ studentId: student.studentId });
    if (existing) {
      return sendResponse({
        res,
        statusCode: 409,
        error: "Face is already enrolled. Ask your administrator to authorize re-enrollment if needed.",
        data: { code: "ALREADY_ENROLLED" },
      });
    }

    const { descriptor, sampleCount, maxSpread } = buildEnrollmentDescriptor(req.body?.samples);

    const profile = await FaceProfile.create({
      studentId: student.studentId,
      student: student._id,
      embeddingEncrypted: encryptEmbedding(descriptor),
      embeddingDimensions: descriptor.length,
      modelVersion: FACE_CONFIG.modelVersion,
      sampleCount,
      sampleSpread: maxSpread,
      enrolledAt: new Date(),
      isActive: true,
    });

    await Student.updateOne(
      { _id: student._id },
      { $set: { isFaceEnrolled: true, faceProfileId: profile._id } }
    );

    return sendResponse({
      res,
      statusCode: 201,
      message: "Face enrollment completed successfully.",
      data: { enrolled: true, enrolledAt: profile.enrolledAt, modelVersion: profile.modelVersion, sampleCount },
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return sendResponse({ res, statusCode: 409, error: "Face is already enrolled.", data: { code: "ALREADY_ENROLLED" } });
    }
    return handleFaceError(res, error, "Face enrollment failed");
  }
};

/**
 * @desc   Identity check against the enrolled profile (used for "test my face").
 *         Does NOT mark attendance; attendance has its own liveness + location pipeline.
 * @route  POST /api/student/face/verify
 * @body   { descriptor: number[] }
 */
export const verifyFace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return studentNotFound(res);

    const probe = parseDescriptor(req.body?.descriptor);
    const enrolled = await loadEnrolledDescriptor(student.studentId);
    if (!enrolled) {
      return sendResponse({
        res,
        statusCode: 409,
        error: "No face enrollment found. Please complete face enrollment first.",
        data: { code: "ENROLLMENT_MISSING" },
      });
    }

    const { matched, confidence, reason } = compareWithEnrollment(probe, enrolled);
    return sendResponse({
      res,
      message: matched ? "Identity matched" : "Identity not matched",
      data: { matched, confidence, reason, code: matched ? "MATCHED" : "FACE_MISMATCH" },
    });
  } catch (error) {
    return handleFaceError(res, error, "Face verification failed");
  }
};
