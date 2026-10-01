import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { User, IUser, UserRole } from "../models/User";
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
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // 1. Extract token from HTTP-only cookie
    if (req.cookies && req.cookies.attendiq_token) {
      token = req.cookies.attendiq_token;
    }
    // 2. Extract token from Authorization header fallback
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return sendResponse({
        res,
        statusCode: 401,
        error: "Authentication required. Please sign in to access this resource.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Attempt to load full user details or use token payload
    let userDetails = await User.findById(decoded.id).select("-password");
    
    if (!userDetails) {
      // In offline/in-memory mode if DB is disconnected, fallback to payload
      req.user = {
        _id: decoded.id,
        name: decoded.email.split("@")[0],
        email: decoded.email,
        role: decoded.role,
      };
    } else {
      if (!userDetails.isActive) {
        return sendResponse({
          res,
          statusCode: 403,
          error: "Account disabled. Please contact your institution admin.",
        });
      }
      req.user = {
        _id: userDetails._id.toString(),
        name: userDetails.name,
        email: userDetails.email,
        role: userDetails.role,
        studentId: userDetails.studentId,
        teacherId: userDetails.teacherId,
      };
    }

    next();
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 401,
      error: "Invalid or expired session token. Please sign in again.",
    });
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendResponse({
        res,
        statusCode: 401,
        error: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendResponse({
        res,
        statusCode: 403,
        error: `Forbidden: Access restricted to ${allowedRoles.join(", ")} roles. Your role is ${req.user.role}.`,
      });
    }

    next();
  };
};
