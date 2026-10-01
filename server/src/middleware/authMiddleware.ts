import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { User, UserRole } from "../models/User";
import { sendResponse } from "../utils/apiResponse";

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    studentId?: string;
    teacherId?: string;
  };
}

interface JwtPayload {
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Verifies the JWT (HTTP-only cookie or Bearer header) and loads the user from the database.
 * Role and identity always come from the database record — never from the token or the request body.
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    if (req.cookies?.attendiq_token) {
      token = req.cookies.attendiq_token;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
    }
    if (!token) {
      return sendResponse({ res, statusCode: 401, error: "Authentication required. Please sign in to access this resource." });
    }

    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
    const user = await User.findById(decoded.id).select("name email role studentId teacherId isActive passwordChangedAt");
    if (!user) {
      return sendResponse({ res, statusCode: 401, error: "Your account no longer exists. Please sign in again." });
    }
    if (!user.isActive) {
      return sendResponse({ res, statusCode: 403, error: "Account disabled. Please contact your institution admin." });
    }
    // Tokens issued before the last password change are no longer valid
    if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return sendResponse({ res, statusCode: 401, error: "Your password was changed. Please sign in again." });
    }

    req.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId,
    };
    next();
  } catch {
    return sendResponse({ res, statusCode: 401, error: "Invalid or expired session token. Please sign in again." });
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendResponse({ res, statusCode: 401, error: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendResponse({ res, statusCode: 403, error: "You do not have permission to access this resource." });
    }
    next();
  };
};
