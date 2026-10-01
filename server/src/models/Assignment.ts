import mongoose, { Document, Schema, Model } from "mongoose";

export type AssignmentStatus = "SUBMITTED" | "PENDING" | "LATE" | "GRADED";

export interface IAssignment extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  title: string;
  description?: string;
  totalMarks: number;
  obtainedMarks?: number;
  dueDate: Date;
  submittedAt?: Date;
  status: AssignmentStatus;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
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
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject reference is required"],
      index: true,
    },
    subjectName: {
      type: String,
      required: [true, "Subject name is required"],
    },
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
    },
    description: {
      type: String,
    },
    totalMarks: {
      type: Number,
      default: 100,
      min: 1,
    },
    obtainedMarks: {
      type: Number,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    submittedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "PENDING", "LATE", "GRADED"],
      default: "PENDING",
      index: true,
    },
    feedback: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

AssignmentSchema.index({ studentId: 1, status: 1 });
AssignmentSchema.index({ subjectId: 1, dueDate: 1 });

// Engagement/risk engines filter by student and due-date window
AssignmentSchema.index({ studentId: 1, dueDate: -1 });

export const Assignment: Model<IAssignment> =
  mongoose.models.Assignment ||
  mongoose.model<IAssignment>("Assignment", AssignmentSchema);
