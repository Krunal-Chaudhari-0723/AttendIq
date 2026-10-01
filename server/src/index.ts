import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/env";
import { connectDB } from "./config/db";
import mainRouter from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { seedDefaultUsers } from "./utils/seedAuth";

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use(mainRouter);

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
app.use(errorHandler);

// Connect DB & Start Server
const startServer = async () => {
  await connectDB();
  await seedDefaultUsers();
  app.listen(config.port, () => {
    console.log(`===================================================`);
    console.log(`🚀 AttendIQ Express API Server Running on Port ${config.port}`);
    console.log(`📍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`===================================================`);
  });
};

startServer();
