"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
const apiResponse_1 = require("../utils/apiResponse");
/**
 * Verifies the JWT (HTTP-only cookie or Bearer header) and loads the user from the database.
 * Role and identity always come from the database record — never from the token or the request body.
 */
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.cookies?.attendiq_token) {
            token = req.cookies.attendiq_token;
        }
        else if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.slice(7);
        }
        if (!token) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Authentication required. Please sign in to access this resource." });
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret, { algorithms: ["HS256"] });
        const user = await User_1.User.findById(decoded.id).select("name email role studentId teacherId isActive passwordChangedAt");
        if (!user) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Your account no longer exists. Please sign in again." });
        }
        if (!user.isActive) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 403, error: "Account disabled. Please contact your institution admin." });
        }
        // Tokens issued before the last password change are no longer valid
        if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Your password was changed. Please sign in again." });
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
    }
    catch {
        return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Invalid or expired session token. Please sign in again." });
    }
};
exports.authenticate = authenticate;
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Authentication required." });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 403, error: "You do not have permission to access this resource." });
        }
        next();
    };
};
exports.authorize = authorize;
