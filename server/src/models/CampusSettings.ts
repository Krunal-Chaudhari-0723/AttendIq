import mongoose, { Document, Schema, Model } from "mongoose";

export interface ICampusSettings extends Document {
  campusName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  isConfigured: boolean;
  isEnforced: boolean;
  defaultSessionMinutes: number;
  defaultLateAfterMinutes: number;
  allowedModes: ("PHYSICAL" | "REMOTE")[];
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampusSettingsSchema = new Schema<ICampusSettings>(
  {
    campusName: {
      type: String,
      required: [true, "Campus name is required"],
      default: "AttendIQ Central Campus",
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, "Campus latitude is required"],
      default: 23.0225, // Configurable default
    },
    longitude: {
      type: Number,
      required: [true, "Campus longitude is required"],
      default: 72.5714, // Configurable default
    },
    radiusMeters: {
      type: Number,
      required: [true, "Allowed campus radius is required"],
      default: 250, // 250 meters configurable radius
      min: 10,
    },
    maxAccuracyMeters: {
      // Reject GPS fixes whose reported accuracy circle is larger than this
      type: Number,
      default: 500,
      min: 10,
      max: 5000,
    },
    isConfigured: {
      // Stays false until an admin saves real campus coordinates
      type: Boolean,
      default: false,
    },
    isEnforced: {
      type: Boolean,
      default: true,
    },
    defaultSessionMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 240,
    },
    defaultLateAfterMinutes: {
      type: Number,
      default: 15,
      min: 0,
      max: 240,
    },
    allowedModes: {
      type: [String],
      enum: ["PHYSICAL", "REMOTE"],
      default: ["PHYSICAL", "REMOTE"],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const CampusSettings: Model<ICampusSettings> =
  mongoose.models.CampusSettings ||
  mongoose.model<ICampusSettings>("CampusSettings", CampusSettingsSchema);
