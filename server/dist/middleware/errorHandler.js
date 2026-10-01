"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const apiResponse_1 = require("../utils/apiResponse");
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.url}:`, err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    return (0, apiResponse_1.sendResponse)({
        res,
        statusCode,
        error: message,
    });
};
exports.errorHandler = errorHandler;
