"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const apiResponse_1 = require("../utils/apiResponse");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
router.get("/health", (req, res) => {
    const dbState = mongoose_1.default.connection.readyState;
    const dbStatusMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
    };
    return (0, apiResponse_1.sendResponse)({
        res,
        statusCode: 200,
        message: "AttendIQ Express API Server is healthy",
        data: {
            status: "UP",
            service: "AttendIQ Core Backend API",
            environment: env_1.config.nodeEnv,
            database: dbStatusMap[dbState] || "unknown",
            uptimeSeconds: process.uptime(),
            timestamp: new Date().toISOString(),
        },
    });
});
exports.default = router;
