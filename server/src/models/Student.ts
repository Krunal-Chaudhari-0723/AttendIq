import mongoose, { Document, Schema, Model } from "mongoose";

export interface IStudent extends Document {
  studentId: string;
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  classId?: mongoose.Types.ObjectId;
  className: string;
  academicYear: string;
  isFaceEnrolled: boolean;
  faceProfileId?: mongoose.Types.ObjectId;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  avatar?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Student email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, "Roll number is required"],
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      default: "Computer Science & Applications",
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },
    className: {
      type: String,
      required: [true, "Class name is required"],
      default: "MCA Sem 2",
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      default: "2025-2026",
    },
    isFaceEnrolled: {
      type: Boolean,
      default: false,
    },
    faceProfileId: {
      type: Schema.Types.ObjectId,
      ref: "FaceProfile",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    avatar: {
      type: String,
    },
    phone: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

StudentSchema.index({ className: 1 });
StudentSchema.index({ academicYear: 1 });

// Class rosters and per-class analytics
StudentSchema.index({ classId: 1, status: 1 });

export const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);
