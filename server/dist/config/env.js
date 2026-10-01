"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") });
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const required = (name, devFallback) => {
    const value = process.env[name];
    if (value)
        return value;
    if (isProduction)
        throw new Error(`Missing required environment variable ${name}`);
    return devFallback;
};
const jwtSecret = required("JWT_SECRET", "attendiq-dev-only-secret-change-me");
if (isProduction && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
}
exports.config = {
    port: parseInt(process.env.PORT || "5000", 10),
    nodeEnv,
    isProduction,
    mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/attendiq"),
    // Comma-separated list of allowed browser origins (e.g. the Vercel URL)
    corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    // Cross-site deployments (frontend and API on different domains) need SameSite=None + Secure
    cookieSameSite: (process.env.COOKIE_SAMESITE || (isProduction ? "none" : "lax")),
    // Demo data is seeded automatically in development; opt in explicitly elsewhere
    seedDemoData: process.env.SEED_DEMO_DATA ? process.env.SEED_DEMO_DATA === "true" : !isProduction,
};
