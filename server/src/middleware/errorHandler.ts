import { Request, Response, NextFunction } from "express";
import { sendResponse } from "../utils/apiResponse";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return sendResponse({
    res,
    statusCode,
    error: message,
  });
};
