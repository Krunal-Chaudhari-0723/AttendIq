"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const apiResponse_1 = require("./utils/apiResponse");
const seedAuth_1 = require("./utils/seedAuth");
const seedData_1 = require("./utils/seedData");
const migrations_1 = require("./utils/migrations");
const app = (0, express_1.default)();
// Behind Render/other proxies: trust the first hop so req.ip and secure cookies work
if (env_1.config.isProduction)
    app.set("trust proxy", 1);
app.disable("x-powered-by");
// Security headers (API only serves JSON/CSV, so the strictest defaults are fine)
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Non-browser clients (curl, health checks) send no Origin header
        if (!origin || env_1.config.corsOrigins.includes(origin))
            return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
// Largest legitimate payload is a liveness/face verification (~30 KB)
app.use(express_1.default.json({ limit: "256kb" }));
app.use(express_1.default.urlencoded({ extended: false, limit: "64kb" }));
// Request logger (method + path only; no bodies, which may contain credentials)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
app.use(routes_1.default);
app.get("/", (req, res) => {
    res.json({ name: "AttendIQ API Server", version: "1.0.0", status: "Running", healthCheck: "/api/health" });
});
// Unknown routes return JSON 404 rather than an HTML page
app.use((req, res) => (0, apiResponse_1.sendResponse)({ res, statusCode: 404, error: "Route not found" }));
app.use(errorHandler_1.errorHandler);
const startServer = async () => {
    await (0, db_1.connectDB)();
    if (env_1.config.seedDemoData) {
        await (0, seedAuth_1.seedDefaultUsers)();
        await (0, seedData_1.seedAllData)();
    }
    await (0, migrations_1.runMigrations)();
    app.listen(env_1.config.port, () => {
        console.log(`===================================================`);
        console.log(`🚀 AttendIQ Express API Server Running on Port ${env_1.config.port}`);
        console.log(`📍 Environment: ${env_1.config.nodeEnv} • demo seed: ${env_1.config.seedDemoData ? "on" : "off"}`);
        console.log(`🔗 Health Check: http://localhost:${env_1.config.port}/api/health`);
        console.log(`===================================================`);
    });
};
startServer();
