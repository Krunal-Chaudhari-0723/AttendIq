import mongoose, { Document, Schema, Model } from "mongoose";

export type NotificationType = "ATTENDANCE" | "RISK_ALERT" | "SYSTEM" | "RECOMMENDATION" | "SESSION" | "REMINDER";

/**
 * Targeting:
 *  - recipientRole + no recipientId  -> everyone with that role ("ALL" = every role)
 *  - recipientId = studentId / teacherId -> one person
 *  - recipientId = "CLASS:<classId>"   -> every student in that class
 * Read state is per user (readBy) so broadcasts work correctly.
 */
export interface INotification extends Document {
  recipientId?: string;
  recipientRole: "ADMIN" | "TEACHER" | "STUDENT" | "ALL";
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  readBy: string[];
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: String, trim: true, index: true },
    recipientRole: { type: String, enum: ["ADMIN", "TEACHER", "STUDENT", "ALL"], default: "ALL", index: true },
    title: { type: String, required: [true, "Notification title is required"], trim: true, maxlength: 140 },
    message: { type: String, required: [true, "Notification message is required"], maxlength: 1000 },
    type: {
      type: String,
      enum: ["ATTENDANCE", "RISK_ALERT", "SYSTEM", "RECOMMENDATION", "SESSION", "REMINDER"],
      default: "SYSTEM",
      index: true,
    },
    link: { type: String, maxlength: 200 },
    readBy: { type: [String], default: [] },
    dedupeKey: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientRole: 1, createdAt: -1 });
// The same event (e.g. weekly low-attendance warning) is only ever stored once
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });

// Per-user visibility query (role + recipient, newest first)
NotificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
