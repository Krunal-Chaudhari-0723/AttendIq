import mongoose, { Document, Schema, Model } from "mongoose";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface IRiskFactor {
  code: string;
  points: number;
  message: string;
}

/**
 * Daily snapshot of the explainable risk indicator (one per student per day).
 * Every level is backed by the rule factors that produced it.
 */
export interface IRiskAssessment extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  studentName: string;
  classId?: mongoose.Types.ObjectId;
  className: string;
  riskLevel: RiskLevel;
  points: number;
  reasons: string[];
  factors: IRiskFactor[];
  attendanceRate: number | null;
  quizAverage: number | null;
  assignmentCompletionRate: number | null;
  engagementScore: number | null;
  status: "ACTIVE" | "RESOLVED" | "UNDER_REVIEW";
  snapshotDate: string;
  engineVersion: string;
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskAssessmentSchema = new Schema<IRiskAssessment>(
  {
    studentId: { type: String, required: true, trim: true, uppercase: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", index: true },
    className: { type: String, required: true },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true, index: true },
    points: { type: Number, required: true, min: 0 },
    reasons: { type: [String], default: [] },
    factors: [{ code: String, points: Number, message: String, _id: false }],
    attendanceRate: { type: Number, min: 0, max: 100, default: null },
    quizAverage: { type: Number, min: 0, max: 100, default: null },
    assignmentCompletionRate: { type: Number, min: 0, max: 100, default: null },
    engagementScore: { type: Number, min: 0, max: 100, default: null },
    status: { type: String, enum: ["ACTIVE", "RESOLVED", "UNDER_REVIEW"], default: "ACTIVE" },
    snapshotDate: { type: String, required: true },
    engineVersion: { type: String, required: true },
    evaluatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

RiskAssessmentSchema.index({ studentId: 1, snapshotDate: -1 }, { unique: true });
RiskAssessmentSchema.index({ classId: 1, riskLevel: 1 });

export const RiskAssessment: Model<IRiskAssessment> =
  mongoose.models.RiskAssessment ||
  mongoose.model<IRiskAssessment>("RiskAssessment", RiskAssessmentSchema);
