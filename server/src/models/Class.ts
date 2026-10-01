import mongoose, { Document, Schema, Model } from "mongoose";

export interface IClass extends Document {
  name: string;
  code: string;
  division: string;
  department: string;
  semester: number;
  academicYear: string;
  studentCount: number;
  classTeacher?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Class code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    division: {
      type: String,
      default: "A",
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      default: "Computer Science & Applications",
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 10,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      default: "2025-2026",
      index: true,
    },
    studentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    classTeacher: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ClassSchema.index({ department: 1, semester: 1 });

export const Class: Model<IClass> =
  mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);
