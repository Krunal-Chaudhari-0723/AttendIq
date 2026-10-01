import { Request, Response, NextFunction } from "express";
import { sendResponse } from "../utils/apiResponse";
import { config } from "../config/env";

/**
 * Last-resort error handler. Client errors (4xx, e.g. malformed JSON) keep their message;
 * unexpected server errors are logged but never leak internals to the client in production.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: { statusCode?: number; status?: number; message?: string; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) console.error(`[Error] ${req.method} ${req.url}:`, err);

  let message = "Internal Server Error";
  if (err.type === "entity.parse.failed") message = "Request body is not valid JSON.";
  else if (err.type === "entity.too.large") message = "Request body is too large.";
  else if (statusCode < 500 || !config.isProduction) message = err.message || message;

  return sendResponse({ res, statusCode, error: message });
};
