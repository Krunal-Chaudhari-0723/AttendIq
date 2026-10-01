import mongoose, { Document, Schema, Model } from "mongoose";

export interface IFaceProfile extends Document {
  studentId: string;
  student: mongoose.Types.ObjectId;
  // AES-256-GCM encrypted 128-d descriptor ("iv.tag.ciphertext", base64 parts)
  embeddingEncrypted: string;
  embeddingDimensions: number;
  modelVersion: string;
  sampleCount: number;
  // Largest distance between enrollment samples (lower = more consistent capture)
  sampleSpread: number;
  enrolledAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const FaceProfileSchema = new Schema<IFaceProfile>(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
      unique: true,
    },
    embeddingEncrypted: {
      type: String,
      required: [true, "Encrypted face embedding is required"],
      select: false, // Never expose embeddings by default per Part F & Part P security rules
    },
    embeddingDimensions: {
      type: Number,
      default: 128,
    },
    modelVersion: {
      type: String,
      required: [true, "Model version is required"],
    },
    sampleCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    sampleSpread: {
      type: Number,
      default: 0,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
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

export const FaceProfile: Model<IFaceProfile> =
  mongoose.models.FaceProfile ||
  mongoose.model<IFaceProfile>("FaceProfile", FaceProfileSchema);
