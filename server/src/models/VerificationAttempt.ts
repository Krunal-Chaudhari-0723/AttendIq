import mongoose, { Document, Schema, Model } from "mongoose";
import { ATTENDANCE_CONFIG } from "../config/verification";

export type AttemptStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED";
export type AttemptStage = "SESSION" | "LOCATION" | "FACE" | "LIVENESS" | "IDENTITY" | "COMPLETE";
export type LivenessChallenge = "TURN_LEFT" | "TURN_RIGHT";

export type AttemptFailureCode =
  | "SESSION_NOT_FOUND"
  | "WRONG_CLASS"
  | "SESSION_INACTIVE"
  | "SESSION_EXPIRED"
  | "DUPLICATE_ATTENDANCE"
  | "ENROLLMENT_MISSING"
  | "STUDENT_INACTIVE"
  | "MODE_NOT_ALLOWED"
  | "CAMPUS_NOT_CONFIGURED"
  | "LOCATION_REQUIRED"
  | "LOCATION_IMPRECISE"
  | "OUTSIDE_RADIUS"
  | "ATTEMPT_EXPIRED"
  | "LIVENESS_FAILED"
  | "FACE_MISMATCH"
  | "INVALID_DESCRIPTOR"
  | "CAMERA_DENIED"
  | "CAMERA_UNAVAILABLE"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "POOR_QUALITY"
  | "CANCELLED"
  | "SUPERSEDED"
  | "PROCESSING_FAILURE";

/**
 * One attendance verification attempt (location -> session -> face -> liveness -> identity).
 * Doubles as a minimal audit trail for teachers. Stores NO coordinates and NO biometric vectors,
 * and is automatically purged after `attemptRetentionDays`.
 */
export interface IVerificationAttempt extends Document {
  sessionId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentId: string;
  studentName: string;
  mode: "PHYSICAL" | "REMOTE";
  status: AttemptStatus;
  stage: AttemptStage;
  failureCode?: AttemptFailureCode;
  message?: string;
  challenge?: LivenessChallenge;
  location?: {
    checked: boolean;
    distanceMeters?: number;
    accuracyMeters?: number;
    radiusMeters?: number;
    withinRadius?: boolean;
  };
  confidence?: number;
  livenessPassed?: boolean;
  expiresAt: Date;
  completedAt?: Date;
  purgeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationAttemptSchema = new Schema<IVerificationAttempt>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentId: { type: String, required: true, uppercase: true, trim: true, index: true },
    studentName: { type: String, required: true },
    mode: { type: String, enum: ["PHYSICAL", "REMOTE"], required: true },
    status: { type: String, enum: ["PENDING", "SUCCEEDED", "FAILED", "EXPIRED"], default: "PENDING", index: true },
    stage: {
      type: String,
      enum: ["SESSION", "LOCATION", "FACE", "LIVENESS", "IDENTITY", "COMPLETE"],
      default: "SESSION",
    },
    failureCode: { type: String },
    message: { type: String },
    challenge: { type: String, enum: ["TURN_LEFT", "TURN_RIGHT"] },
    location: {
      checked: { type: Boolean, default: false },
      distanceMeters: { type: Number },
      accuracyMeters: { type: Number },
      radiusMeters: { type: Number },
      withinRadius: { type: Boolean },
    },
    confidence: { type: Number, min: 0, max: 1 },
    livenessPassed: { type: Boolean },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
    purgeAt: {
      type: Date,
      default: () => new Date(Date.now() + ATTENDANCE_CONFIG.attemptRetentionDays * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

VerificationAttemptSchema.index({ sessionId: 1, createdAt: -1 });
VerificationAttemptSchema.index({ student: 1, sessionId: 1, status: 1 });
// MongoDB TTL index: documents are deleted automatically once purgeAt passes
VerificationAttemptSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationAttempt: Model<IVerificationAttempt> =
  mongoose.models.VerificationAttempt ||
  mongoose.model<IVerificationAttempt>("VerificationAttempt", VerificationAttemptSchema);
