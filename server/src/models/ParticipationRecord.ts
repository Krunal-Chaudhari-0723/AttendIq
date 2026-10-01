import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Teacher-recorded class participation for one student in one session.
 * rating: 0 = none, 1 = low, 2 = good, 3 = excellent  (score = rating / 3 * 100)
 */
export interface IParticipationRecord extends Document {
  sessionId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentId: string;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  rating: 0 | 1 | 2 | 3;
  ratedBy: mongoose.Types.ObjectId;
  ratedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipationRecordSchema = new Schema<IParticipationRecord>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentId: { type: String, required: true, uppercase: true, trim: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    rating: { type: Number, enum: [0, 1, 2, 3], required: true },
    ratedBy: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    ratedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

ParticipationRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
ParticipationRecordSchema.index({ studentId: 1, ratedAt: -1 });

export const ParticipationRecord: Model<IParticipationRecord> =
  mongoose.models.ParticipationRecord ||
  mongoose.model<IParticipationRecord>("ParticipationRecord", ParticipationRecordSchema);
