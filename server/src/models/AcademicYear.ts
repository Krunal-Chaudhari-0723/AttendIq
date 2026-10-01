import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAcademicYear extends Document {
  name: string; // e.g., "2025-2026"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicYearSchema = new Schema<IAcademicYear>(
  {
    name: {
      type: String,
      required: [true, "Academic year name is required"],
      unique: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// If an academic year is set to active, ensure all others are marked inactive
AcademicYearSchema.pre("save", async function (next) {
  if (this.isModified("isActive") && this.isActive) {
    await (this.constructor as Model<IAcademicYear>).updateMany(
      { _id: { $ne: this._id } },
      { $set: { isActive: false } }
    );
  }
  next();
});

export const AcademicYear: Model<IAcademicYear> =
  mongoose.models.AcademicYear ||
  mongoose.model<IAcademicYear>("AcademicYear", AcademicYearSchema);
