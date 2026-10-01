"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.register = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
// Helper to generate JWT token
const generateToken = (id, email, role) => {
    return jsonwebtoken_1.default.sign({ id, email, role }, env_1.config.jwtSecret, {
        expiresIn: "7d",
    });
};
// Helper to set token cookie
const setTokenCookie = (res, token) => {
    res.cookie("attendiq_token", token, {
        httpOnly: true,
        secure: env_1.config.nodeEnv === "production",
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
        passwordHash: bcryptjs_1.default.hashSync("Admin@123456", 10),
        role: "ADMIN",
    },
    {
        id: "demo-teacher-1",
        name: "Prof. Sharma",
        email: "sharma@attendiq.edu",
        passwordHash: bcryptjs_1.default.hashSync("Teacher@123456", 10),
        role: "TEACHER",
        teacherId: "T201",
    },
    {
        id: "demo-student-1",
        name: "Anand Chaudhari",
        email: "anand.student@attendiq.edu",
        passwordHash: bcryptjs_1.default.hashSync("Student@123456", 10),
        role: "STUDENT",
        studentId: "S101",
    },
];
/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        // 1. Input Validation
        if (!email || !password) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 400,
                error: "Please provide both email and password.",
            });
        }
        const cleanEmail = email.toLowerCase().trim();
        let user = await User_1.User.findOne({ email: cleanEmail }).select("+password");
        let isValidPassword = false;
        if (user) {
            isValidPassword = await user.matchPassword(password);
        }
        else {
            // Offline / fallback check for seed accounts
            const fallbackUser = DEMO_FALLBACK_USERS.find((u) => u.email === cleanEmail);
            if (fallbackUser) {
                isValidPassword = await bcryptjs_1.default.compare(password, fallbackUser.passwordHash);
                if (isValidPassword) {
                    const token = generateToken(fallbackUser.id, fallbackUser.email, fallbackUser.role);
                    setTokenCookie(res, token);
                    return (0, apiResponse_1.sendResponse)({
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
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 401,
                error: "Invalid email or password. Please check your credentials.",
            });
        }
        // Role validation check if requested explicitly
        if (role && user.role !== role) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 403,
                error: `Your account is registered as ${user.role}, not ${role}. Please switch to the correct role tab.`,
            });
        }
        if (!user.isActive) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 403,
                error: "Account disabled. Please contact your institution admin.",
            });
        }
        // Generate token
        const token = generateToken(user._id.toString(), user.email, user.role);
        setTokenCookie(res, token);
        return (0, apiResponse_1.sendResponse)({
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
    }
    catch (error) {
        console.error("[Auth Error] Login failure:", error);
        return (0, apiResponse_1.sendResponse)({
            res,
            statusCode: 500,
            error: "An unexpected error occurred during sign in.",
        });
    }
};
exports.login = login;
/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public / Admin
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role, studentId, teacherId } = req.body;
        if (!name || !email || !password) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 400,
                error: "Please provide name, email, and password.",
            });
        }
        const cleanEmail = email.toLowerCase().trim();
        const userExists = await User_1.User.findOne({ email: cleanEmail });
        if (userExists) {
            return (0, apiResponse_1.sendResponse)({
                res,
                statusCode: 400,
                error: "An account with this email address already exists.",
            });
        }
        const user = await User_1.User.create({
            name,
            email: cleanEmail,
            password,
            role: role || "STUDENT",
            studentId,
            teacherId,
        });
        const token = generateToken(user._id.toString(), user.email, user.role);
        setTokenCookie(res, token);
        return (0, apiResponse_1.sendResponse)({
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
    }
    catch (error) {
        console.error("[Auth Error] Register failure:", error);
        return (0, apiResponse_1.sendResponse)({
            res,
            statusCode: 500,
            error: "Could not create account.",
        });
    }
};
exports.register = register;
/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = (req, res) => {
    res.cookie("attendiq_token", "", {
        httpOnly: true,
        expires: new Date(0),
    });
    return (0, apiResponse_1.sendResponse)({
        res,
        statusCode: 200,
        message: "Signed out successfully",
    });
};
exports.logout = logout;
/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    if (!req.user) {
        return (0, apiResponse_1.sendResponse)({
            res,
            statusCode: 401,
            error: "Not authenticated",
        });
    }
    return (0, apiResponse_1.sendResponse)({
        res,
        statusCode: 200,
        data: {
            user: req.user,
        },
    });
};
exports.getMe = getMe;
