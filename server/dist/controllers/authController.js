"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
const ROLES = ["ADMIN", "TEACHER", "STUDENT"];
/** The token carries only the user id; role and identity are re-read from the database on every request. */
const generateToken = (id) => jsonwebtoken_1.default.sign({ id }, env_1.config.jwtSecret, { expiresIn: env_1.config.jwtExpiresIn, algorithm: "HS256" });
const cookieOptions = () => ({
    httpOnly: true,
    secure: env_1.config.isProduction || env_1.config.cookieSameSite === "none",
    sameSite: env_1.config.cookieSameSite,
    path: "/",
});
const serializeUser = (user) => ({
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
const login = async (req, res) => {
    try {
        const { email, password, role } = req.body ?? {};
        if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 400, error: "Please provide both email and password." });
        }
        if (role !== undefined && !ROLES.includes(role)) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 400, error: "Invalid role selected." });
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase().trim() }).select("+password");
        // Same message for unknown email and wrong password (no account enumeration)
        if (!user || !(await user.matchPassword(password))) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Invalid email or password. Please check your credentials." });
        }
        if (!user.isActive) {
            return (0, apiResponse_1.sendResponse)({ res, statusCode: 403, error: "Account disabled. Please contact your institution admin." });
        }
        if (role && user.role !== role) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 403,
                error: `This account is not a ${role.toLowerCase()} account. Please switch to the correct role tab.`,
            });
        }
        const token = generateToken(user._id.toString());
        res.cookie("attendiq_token", token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
        return (0, apiResponse_1.sendResponse)({ res, message: "Login successful", data: { token, user: serializeUser(user) } });
    }
    catch (error) {
        console.error("[Auth] Login failure:", error);
        return (0, apiResponse_1.sendResponse)({ res, statusCode: 500, error: "An unexpected error occurred during sign in." });
    }
};
exports.login = login;
/**
 * @desc    Clear the session cookie
 * @route   POST /api/auth/logout
 */
const logout = (req, res) => {
    res.clearCookie("attendiq_token", cookieOptions());
    return (0, apiResponse_1.sendResponse)({ res, message: "Signed out successfully" });
};
exports.logout = logout;
/**
 * @desc    Current authenticated user
 * @route   GET /api/auth/me
 */
const getMe = async (req, res) => {
    if (!req.user)
        return (0, apiResponse_1.sendResponse)({ res, statusCode: 401, error: "Not authenticated" });
    return (0, apiResponse_1.sendResponse)({ res, data: { user: req.user } });
};
exports.getMe = getMe;
