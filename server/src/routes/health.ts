import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { sendResponse } from "../utils/apiResponse";
import { config } from "../config/env";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return sendResponse({
    res,
    statusCode: 200,
    message: "AttendIQ Express API Server is healthy",
    data: {
      status: "UP",
      service: "AttendIQ Core Backend API",
      environment: config.nodeEnv,
      database: dbStatusMap[dbState] || "unknown",
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
