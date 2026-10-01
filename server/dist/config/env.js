"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") });
exports.config = {
    port: parseInt(process.env.PORT || "5000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/attendiq",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    jwtSecret: process.env.JWT_SECRET || "attendiq_master_secret_key_2026",
};
