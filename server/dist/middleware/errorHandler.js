"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const apiResponse_1 = require("../utils/apiResponse");
const env_1 = require("../config/env");
/**
 * Last-resort error handler. Client errors (4xx, e.g. malformed JSON) keep their message;
 * unexpected server errors are logged but never leak internals to the client in production.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err, req, res, _next) => {
    const statusCode = err.statusCode || err.status || 500;
    if (statusCode >= 500)
        console.error(`[Error] ${req.method} ${req.url}:`, err);
    let message = "Internal Server Error";
    if (err.type === "entity.parse.failed")
        message = "Request body is not valid JSON.";
    else if (err.type === "entity.too.large")
        message = "Request body is too large.";
    else if (statusCode < 500 || !env_1.config.isProduction)
        message = err.message || message;
    return (0, apiResponse_1.sendResponse)({ res, statusCode, error: message });
};
exports.errorHandler = errorHandler;
