import mongoose, { Document, Schema, Model } from "mongoose";

export interface IEngagementComponents {
  attendance: number | null;       // 30% weight
  quiz: number | null;             // 25% weight
  assignments: number | null;      // 20% weight
  participation: number | null;    // 15% weight
  learningActivity: number | null; // 10% weight
}

/**
 * Daily snapshot of a computed engagement score (one per student per day).
 * Components are null when there was no data for them in the window.
 */
export interface IEngagementScore extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  overallScore: number | null;
  components: IEngagementComponents;
  missingComponents: string[];
  coverage: number; // share of total weight backed by data (0-1)
  trend: "UP" | "DOWN" | "STABLE" | "NEW";
  windowDays: number;
  snapshotDate: string; // YYYY-MM-DD
  engineVersion: string;
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const component = { type: Number, min: 0, max: 100, default: null };

const EngagementScoreSchema = new Schema<IEngagementScore>(
  {
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
      index: true,
    },
    overallScore: { type: Number, min: 0, max: 100, default: null, index: true },
    components: {
      attendance: component,
      quiz: component,
      assignments: component,
      participation: component,
      learningActivity: component,
    },
    missingComponents: { type: [String], default: [] },
    coverage: { type: Number, min: 0, max: 1, default: 0 },
    trend: { type: String, enum: ["UP", "DOWN", "STABLE", "NEW"], default: "NEW" },
    windowDays: { type: Number, default: 30 },
    snapshotDate: { type: String, required: true },
    engineVersion: { type: String, required: true },
    evaluatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

EngagementScoreSchema.index({ studentId: 1, snapshotDate: -1 }, { unique: true });

export const EngagementScore: Model<IEngagementScore> =
  mongoose.models.EngagementScore ||
  mongoose.model<IEngagementScore>("EngagementScore", EngagementScoreSchema);
