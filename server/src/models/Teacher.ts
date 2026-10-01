import mongoose, { Document, Schema, Model } from "mongoose";

export interface ITeacher extends Document {
  teacherId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  subjectsTaught: mongoose.Types.ObjectId[];
  assignedClasses: mongoose.Types.ObjectId[];
  status: "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    teacherId: {
      type: String,
      required: [true, "Teacher ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Teacher email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      default: "Computer Science & Applications",
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      default: "Assistant Professor",
    },
    subjectsTaught: [
      {
        type: Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    assignedClasses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "INACTIVE"],
      default: "ACTIVE",
    },
    phone: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>("Teacher", TeacherSchema);
