import mongoose, { Document, Schema, Model } from "mongoose";

export type LearningActivityType = "STUDY_SESSION" | "PRACTICE" | "RECOMMENDATION_ACTION";

/**
 * Learning activity logged by a student (self-study, practice) or recorded when the student
 * completes a recommended action. Self-reported entries are labelled as such in the UI.
 */
export interface ILearningActivity extends Document {
  student: mongoose.Types.ObjectId;
  studentId: string;
  type: LearningActivityType;
  title: string;
  minutes: number;
  subjectId?: mongoose.Types.ObjectId;
  subjectName?: string;
  recommendationId?: mongoose.Types.ObjectId;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LearningActivitySchema = new Schema<ILearningActivity>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentId: { type: String, required: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ["STUDY_SESSION", "PRACTICE", "RECOMMENDATION_ACTION"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    minutes: { type: Number, required: true, min: 1, max: 600 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    subjectName: { type: String },
    recommendationId: { type: Schema.Types.ObjectId, ref: "Recommendation" },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LearningActivitySchema.index({ studentId: 1, occurredAt: -1 });

export const LearningActivity: Model<ILearningActivity> =
  mongoose.models.LearningActivity ||
  mongoose.model<ILearningActivity>("LearningActivity", LearningActivitySchema);
