import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["ADMIN", "TEACHER", "STUDENT"],
      required: [true, "Role is required"],
      default: "STUDENT",
    },
    studentId: {
      type: String,
      default: undefined,
    },
    teacherId: {
      type: String,
      default: undefined,
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

// Encrypt password using bcrypt before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
