import mongoose, { Document, Schema, Model } from "mongoose";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type VerificationMethod = "FACE_AND_LOCATION" | "FACE_ONLY" | "REMOTE_FACE" | "MANUAL" | "NOT_VERIFIED";

export interface IAttendanceRecord extends Document {
  sessionId: mongoose.Types.ObjectId;
  studentId: string;
  student: mongoose.Types.ObjectId;
  status: AttendanceStatus;
  verificationMethod: VerificationMethod;
  confidence: number;
  livenessVerified: boolean;
  locationVerified: boolean;
  verificationMetadata?: {
    distanceMeters?: number;
    withinRadius?: boolean;
    accuracyMeters?: number;
    attemptId?: mongoose.Types.ObjectId;
    challenge?: string;
    note?: string;
  };
  markedAt: Date;
  markedBy: "STUDENT" | "TEACHER" | "ADMIN" | "SYSTEM";
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceSession",
      required: [true, "Session ID is required"],
      index: true,
    },
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
    },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
      default: "PRESENT",
      required: true,
      index: true,
    },
    verificationMethod: {
      type: String,
      enum: ["FACE_AND_LOCATION", "FACE_ONLY", "REMOTE_FACE", "MANUAL", "NOT_VERIFIED"],
      default: "FACE_AND_LOCATION",
      required: true,
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    livenessVerified: {
      type: Boolean,
      default: false,
    },
    locationVerified: {
      type: Boolean,
      default: false,
    },
    verificationMetadata: {
      distanceMeters: { type: Number },
      withinRadius: { type: Boolean },
      accuracyMeters: { type: Number },
      attemptId: { type: Schema.Types.ObjectId, ref: "VerificationAttempt" },
      challenge: { type: String },
      note: { type: String, maxlength: 300 },
    },
    markedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    markedBy: {
      type: String,
      enum: ["STUDENT", "TEACHER", "ADMIN", "SYSTEM"],
      default: "STUDENT",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to strictly prevent duplicate attendance in the same session
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
AttendanceRecordSchema.index({ studentId: 1, markedAt: -1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecord>("AttendanceRecord", AttendanceRecordSchema);
