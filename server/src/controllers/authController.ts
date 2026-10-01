import { Request, Response, CookieOptions } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { User, UserRole } from "../models/User";
import { config } from "../config/env";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const ROLES: UserRole[] = ["ADMIN", "TEACHER", "STUDENT"];

/** The token carries only the user id; role and identity are re-read from the database on every request. */
const generateToken = (id: string): string =>
  jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"], algorithm: "HS256" });

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProduction || config.cookieSameSite === "none",
  sameSite: config.cookieSameSite,
  path: "/",
});

const serializeUser = (user: InstanceType<typeof User>) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentId: user.studentId,
  teacherId: user.teacherId,
});

/**
 * @desc    Authenticate user & issue a session
 * @route   POST /api/auth/login  { email, password, role? }
 * @access  Public (rate limited)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return sendResponse({ res, statusCode: 400, error: "Please provide both email and password." });
    }
    if (role !== undefined && !ROLES.includes(role)) {
      return sendResponse({ res, statusCode: 400, error: "Invalid role selected." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    // Same message for unknown email and wrong password (no account enumeration)
    if (!user || !(await user.matchPassword(password))) {
      return sendResponse({ res, statusCode: 401, error: "Invalid email or password. Please check your credentials." });
    }
    if (!user.isActive) {
      return sendResponse({ res, statusCode: 403, error: "Account disabled. Please contact your institution admin." });
    }
    if (role && user.role !== role) {
      return sendResponse({
        res,
        statusCode: 403,
        error: `This account is not a ${role.toLowerCase()} account. Please switch to the correct role tab.`,
      });
    }

    const token = generateToken(user._id.toString());
    res.cookie("attendiq_token", token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    return sendResponse({ res, message: "Login successful", data: { token, user: serializeUser(user) } });
  } catch (error) {
    console.error("[Auth] Login failure:", error);
    return sendResponse({ res, statusCode: 500, error: "An unexpected error occurred during sign in." });
  }
};

/**
 * @desc    Clear the session cookie
 * @route   POST /api/auth/logout
 */
export const logout = (req: Request, res: Response) => {
  res.clearCookie("attendiq_token", cookieOptions());
  return sendResponse({ res, message: "Signed out successfully" });
};

/**
 * @desc    Current authenticated user
 * @route   GET /api/auth/me
 */
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendResponse({ res, statusCode: 401, error: "Not authenticated" });
  return sendResponse({ res, data: { user: req.user } });
};
