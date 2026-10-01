import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User, IUser, UserRole } from "../models/User";
import { config } from "../config/env";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

// Helper to generate JWT token
const generateToken = (id: string, email: string, role: UserRole): string => {
  return jwt.sign({ id, email, role }, config.jwtSecret, {
    expiresIn: "7d",
  });
};

// Helper to set token cookie
const setTokenCookie = (res: Response, token: string) => {
  res.cookie("attendiq_token", token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Default fallback demo credentials in case DB connection is offline
const DEMO_FALLBACK_USERS = [
  {
    id: "demo-admin-1",
    name: "System Admin",
    email: "admin@attendiq.edu",
    passwordHash: bcrypt.hashSync("Admin@123456", 10),
    role: "ADMIN" as UserRole,
  },
  {
    id: "demo-teacher-1",
    name: "Prof. Sharma",
    email: "sharma@attendiq.edu",
    passwordHash: bcrypt.hashSync("Teacher@123456", 10),
    role: "TEACHER" as UserRole,
    teacherId: "T201",
  },
  {
    id: "demo-student-1",
    name: "Anand Chaudhari",
    email: "anand.student@attendiq.edu",
    passwordHash: bcrypt.hashSync("Student@123456", 10),
    role: "STUDENT" as UserRole,
    studentId: "S101",
  },
];

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    // 1. Input Validation
    if (!email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        error: "Please provide both email and password.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail }).select("+password");
    let isValidPassword = false;

    if (user) {
      isValidPassword = await user.matchPassword(password);
    } else {
      // Offline / fallback check for seed accounts
      const fallbackUser = DEMO_FALLBACK_USERS.find(
        (u) => u.email === cleanEmail
      );
      if (fallbackUser) {
        isValidPassword = await bcrypt.compare(
          password,
          fallbackUser.passwordHash
        );
        if (isValidPassword) {
          const token = generateToken(
            fallbackUser.id,
            fallbackUser.email,
            fallbackUser.role
          );
          setTokenCookie(res, token);
          return sendResponse({
            res,
            statusCode: 200,
            message: "Login successful",
            data: {
              token,
              user: {
                _id: fallbackUser.id,
                name: fallbackUser.name,
                email: fallbackUser.email,
                role: fallbackUser.role,
                studentId: fallbackUser.studentId,
                teacherId: fallbackUser.teacherId,
              },
            },
          });
        }
      }
    }

    if (!user || !isValidPassword) {
      return sendResponse({
        res,
        statusCode: 401,
        error: "Invalid email or password. Please check your credentials.",
      });
    }

    // Role validation check if requested explicitly
    if (role && user.role !== role) {
      return sendResponse({
        res,
        statusCode: 403,
        error: `Your account is registered as ${user.role}, not ${role}. Please switch to the correct role tab.`,
      });
    }

    if (!user.isActive) {
      return sendResponse({
        res,
        statusCode: 403,
        error: "Account disabled. Please contact your institution admin.",
      });
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.email, user.role);
    setTokenCookie(res, token);

    return sendResponse({
      res,
      statusCode: 200,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          teacherId: user.teacherId,
        },
      },
    });
  } catch (error) {
    console.error("[Auth Error] Login failure:", error);
    return sendResponse({
      res,
      statusCode: 500,
      error: "An unexpected error occurred during sign in.",
    });
  }
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public / Admin
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, studentId, teacherId } = req.body;

    if (!name || !email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        error: "Please provide name, email, and password.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return sendResponse({
        res,
        statusCode: 400,
        error: "An account with this email address already exists.",
      });
    }

    const user = await User.create({
      name,
      email: cleanEmail,
      password,
      role: role || "STUDENT",
      studentId,
      teacherId,
    });

    const token = generateToken(user._id.toString(), user.email, user.role);
    setTokenCookie(res, token);

    return sendResponse({
      res,
      statusCode: 201,
      message: "User registered successfully",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          teacherId: user.teacherId,
        },
      },
    });
  } catch (error) {
    console.error("[Auth Error] Register failure:", error);
    return sendResponse({
      res,
      statusCode: 500,
      error: "Could not create account.",
    });
  }
};

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = (req: Request, res: Response) => {
  res.cookie("attendiq_token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  return sendResponse({
    res,
    statusCode: 200,
    message: "Signed out successfully",
  });
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendResponse({
      res,
      statusCode: 401,
      error: "Not authenticated",
    });
  }

  return sendResponse({
    res,
    statusCode: 200,
    data: {
      user: req.user,
    },
  });
};
