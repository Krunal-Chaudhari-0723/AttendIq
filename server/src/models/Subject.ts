import mongoose, { Document, Schema, Model } from "mongoose";

export interface ISubject extends Document {
  name: string;
  code: string;
  classId: mongoose.Types.ObjectId;
  teacherId?: mongoose.Types.ObjectId;
  department: string;
  credits: number;
  totalHours: number;
  semester: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Subject code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class reference is required"],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      index: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      default: "Computer Science & Applications",
    },
    credits: {
      type: Number,
      default: 4,
      min: 1,
    },
    totalHours: {
      type: Number,
      default: 45,
      min: 1,
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
    },
  },
  {
    timestamps: true,
  }
);

export const Subject: Model<ISubject> =
  mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);
