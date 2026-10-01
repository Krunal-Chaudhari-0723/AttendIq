"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = void 0;
const sendResponse = ({ res, statusCode = 200, message, data, error, }) => {
    return res.status(statusCode).json({
        success: statusCode >= 200 && statusCode < 300,
        message,
        data,
        error,
        timestamp: new Date().toISOString(),
    });
};
exports.sendResponse = sendResponse;
