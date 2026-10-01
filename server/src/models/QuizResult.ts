import mongoose, { Document, Schema, Model } from "mongoose";

export interface IQuizResult extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  quizTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  dateTaken: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuizResultSchema = new Schema<IQuizResult>(
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
    quizTitle: {
      type: String,
      required: [true, "Quiz title is required"],
    },
    score: {
      type: Number,
      required: [true, "Score is required"],
      min: 0,
    },
    totalMarks: {
      type: Number,
      required: [true, "Total marks is required"],
      default: 100,
      min: 1,
    },
    percentage: {
      type: Number,
      required: [true, "Percentage is required"],
      min: 0,
      max: 100,
    },
    dateTaken: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

QuizResultSchema.index({ studentId: 1, subjectId: 1 });
QuizResultSchema.index({ studentId: 1, dateTaken: -1 });

export const QuizResult: Model<IQuizResult> =
  mongoose.models.QuizResult ||
  mongoose.model<IQuizResult>("QuizResult", QuizResultSchema);
