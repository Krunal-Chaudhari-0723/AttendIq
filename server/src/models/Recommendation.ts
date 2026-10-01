import mongoose, { Document, Schema, Model } from "mongoose";

export const RECOMMENDATION_CATEGORIES = [
  "ATTENDANCE",
  "ASSIGNMENT_SUPPORT",
  "REVISION",
  "EXTRA_PRACTICE",
  "TEACHER_INTERVENTION",
  "PARENT_COMMUNICATION",
  "MENTORING",
  "FOLLOW_UP",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface IRecommendationItem {
  action: string;
  description: string;
  priority: Priority;
  category: RecommendationCategory;
  audience: "STUDENT" | "TEACHER";
  supportingFactors: string[]; // resolved from server-built facts, never free model text
  completedAt?: Date;
}

/**
 * Recommendation set for one student.
 * source = "AI" only when the language model actually produced it; otherwise "RULE_BASED".
 */
export interface IRecommendation extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  summary: string;
  recommendations: IRecommendationItem[];
  priority: Priority;
  supportingFactors: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  source: "AI" | "RULE_BASED";
  aiModel?: string;
  fallbackReason?: string;
  generatedByRole: "TEACHER" | "STUDENT" | "SYSTEM";
  generatedBy?: mongoose.Types.ObjectId;
  engineVersion: string;
  isActive: boolean;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = new Schema<IRecommendation>(
  {
    studentId: { type: String, required: true, trim: true, uppercase: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    summary: { type: String, required: true },
    recommendations: [
      {
        action: { type: String, required: true },
        description: { type: String, required: true },
        priority: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
        category: { type: String, enum: RECOMMENDATION_CATEGORIES, required: true },
        audience: { type: String, enum: ["STUDENT", "TEACHER"], required: true },
        supportingFactors: { type: [String], default: [] },
        completedAt: { type: Date },
      },
    ],
    priority: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM", index: true },
    supportingFactors: { type: [String], default: [] },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "UNKNOWN"], default: "UNKNOWN" },
    source: { type: String, enum: ["AI", "RULE_BASED"], required: true },
    aiModel: { type: String },
    fallbackReason: { type: String },
    generatedByRole: { type: String, enum: ["TEACHER", "STUDENT", "SYSTEM"], required: true },
    generatedBy: { type: Schema.Types.ObjectId },
    engineVersion: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

RecommendationSchema.index({ studentId: 1, generatedAt: -1 });

export const Recommendation: Model<IRecommendation> =
  mongoose.models.Recommendation || mongoose.model<IRecommendation>("Recommendation", RecommendationSchema);
