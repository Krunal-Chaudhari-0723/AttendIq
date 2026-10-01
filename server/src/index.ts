import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config/env";
import { connectDB } from "./config/db";
import mainRouter from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { sendResponse } from "./utils/apiResponse";
import { seedDefaultUsers } from "./utils/seedAuth";
import { seedAllData } from "./utils/seedData";
import { runMigrations } from "./utils/migrations";

const app = express();

// Behind Render/other proxies: trust the first hop so req.ip and secure cookies work
if (config.isProduction) app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security headers (API only serves JSON/CSV, so the strictest defaults are fine)
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, health checks) send no Origin header
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
// Largest legitimate payload is a liveness/face verification (~30 KB)
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

// Request logger (method + path only; no bodies, which may contain credentials)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(mainRouter);

app.get("/", (req, res) => {
  res.json({ name: "AttendIQ API Server", version: "1.0.0", status: "Running", healthCheck: "/api/health" });
});

// Unknown routes return JSON 404 rather than an HTML page
app.use((req, res) => sendResponse({ res, statusCode: 404, error: "Route not found" }));

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  if (config.seedDemoData) {
    await seedDefaultUsers();
    await seedAllData();
  }
  await runMigrations();
  app.listen(config.port, () => {
    console.log(`===================================================`);
    console.log(`🚀 AttendIQ Express API Server Running on Port ${config.port}`);
    console.log(`📍 Environment: ${config.nodeEnv} • demo seed: ${config.seedDemoData ? "on" : "off"}`);
    console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`===================================================`);
  });
};

startServer();
