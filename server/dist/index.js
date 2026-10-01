"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const seedAuth_1 = require("./utils/seedAuth");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({ origin: env_1.config.corsOrigin, credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// Routes
app.use(routes_1.default);
// Root route
app.get("/", (req, res) => {
    res.json({
        name: "AttendIQ API Server",
        version: "1.0.0",
        status: "Running",
        healthCheck: "/api/health",
    });
});
// Global Error Handler
app.use(errorHandler_1.errorHandler);
// Connect DB & Start Server
const startServer = async () => {
    await (0, db_1.connectDB)();
    await (0, seedAuth_1.seedDefaultUsers)();
    app.listen(env_1.config.port, () => {
        console.log(`===================================================`);
        console.log(`🚀 AttendIQ Express API Server Running on Port ${env_1.config.port}`);
        console.log(`📍 Environment: ${env_1.config.nodeEnv}`);
        console.log(`🔗 Health Check: http://localhost:${env_1.config.port}/api/health`);
        console.log(`===================================================`);
    });
};
startServer();
