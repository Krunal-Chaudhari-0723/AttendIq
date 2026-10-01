import { Response } from "express";

export interface ApiResponseOptions<T = any> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  error?: string;
}

export const sendResponse = <T>({
  res,
  statusCode = 200,
  message,
  data,
  error,
}: ApiResponseOptions<T>) => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    error,
    timestamp: new Date().toISOString(),
  });
};
