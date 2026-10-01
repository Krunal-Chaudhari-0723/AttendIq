import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import { sendResponse } from "../utils/apiResponse";

/**
 * Minimal fixed-window rate limiter keyed by authenticated user (or IP).
 * In-memory is enough for a single-instance deployment; use Redis if scaled horizontally.
 */
export const rateLimit = ({
  windowMs,
  max,
  name,
  key,
}: {
  windowMs: number;
  max: number;
  name: string;
  /** Custom bucket key; defaults to the authenticated user id, else the client IP */
  key?: (req: AuthenticatedRequest) => string;
}) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const bucket = `${name}:${key ? key(req) : req.user?._id || req.ip}`;
    const now = Date.now();
    const entry = hits.get(bucket);

    if (!entry || entry.resetAt <= now) {
      hits.set(bucket, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
      return sendResponse({
        res,
        statusCode: 429,
        error: "Too many attempts. Please wait a moment and try again.",
      });
    }
    next();
  };
};
