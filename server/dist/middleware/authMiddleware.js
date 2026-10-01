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
const authenticate = async (req, res, next) => {
    try {
        let token;
        // 1. Extract token from HTTP-only cookie
        if (req.cookies && req.cookies.attendiq_token) {
            token = req.cookies.attendiq_token;
        }
        // 2. Extract token from Authorization header fallback
        else if (req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 401,
                error: "Authentication required. Please sign in to access this resource.",
            });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
        // Attempt to load full user details or use token payload
        let userDetails = await User_1.User.findById(decoded.id).select("-password");
        if (!userDetails) {
            // In offline/in-memory mode if DB is disconnected, fallback to payload
            req.user = {
                _id: decoded.id,
                name: decoded.email.split("@")[0],
                email: decoded.email,
                role: decoded.role,
            };
        }
        else {
            if (!userDetails.isActive) {
                return (0, apiResponse_1.sendResponse)({
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
    }
    catch (error) {
        return (0, apiResponse_1.sendResponse)({
            res,
            statusCode: 401,
            error: "Invalid or expired session token. Please sign in again.",
        });
    }
};
exports.authenticate = authenticate;
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 401,
                error: "Authentication required.",
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 403,
                error: `Forbidden: Access restricted to ${allowedRoles.join(", ")} roles. Your role is ${req.user.role}.`,
            });
        }
        next();
    };
};
exports.authorize = authorize;
