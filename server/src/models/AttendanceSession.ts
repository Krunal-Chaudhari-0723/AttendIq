import mongoose, { Document, Schema, Model } from "mongoose";

export type SessionMode = "PHYSICAL" | "REMOTE";
export type SessionStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface IAttendanceSession extends Document {
  classId: mongoose.Types.ObjectId;
  className: string;
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  teacherId: mongoose.Types.ObjectId;
  teacherName: string;
  mode: SessionMode;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  isActive: boolean;
  room?: string;
  division?: string;
  durationMinutes: number;
  lateAfterMinutes: number;
  endedAt?: Date;
  endedBy?: "TEACHER" | "SYSTEM";
  dynamicCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true,
    },
    className: {
      type: String,
      required: [true, "Class name is required"],
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
      index: true,
    },
    subjectName: {
      type: String,
      required: [true, "Subject name is required"],
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Teacher is required"],
      index: true,
    },
    teacherName: {
      type: String,
      required: [true, "Teacher name is required"],
    },
    mode: {
      type: String,
      enum: ["PHYSICAL", "REMOTE"],
      default: "PHYSICAL",
      required: true,
    },
    startTime: {
      type: Date,
      required: [true, "Session start time is required"],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, "Session end time is required"],
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    room: {
      type: String,
      trim: true,
    },
    division: {
      type: String,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },
    lateAfterMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    endedAt: {
      type: Date,
    },
    endedBy: {
      type: String,
      enum: ["TEACHER", "SYSTEM"],
    },
    dynamicCode: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

AttendanceSessionSchema.index({ classId: 1, status: 1 });
AttendanceSessionSchema.index({ teacherId: 1, status: 1 });

// Reports filter by date range and status
AttendanceSessionSchema.index({ startTime: -1, status: 1 });

export const AttendanceSession: Model<IAttendanceSession> =
  mongoose.models.AttendanceSession ||
  mongoose.model<IAttendanceSession>("AttendanceSession", AttendanceSessionSchema);
