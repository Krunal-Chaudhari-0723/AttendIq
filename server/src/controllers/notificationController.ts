import { Response } from "express";
import mongoose from "mongoose";
import { Notification } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { ensureAssignmentReminders, visibilityFilter } from "../services/notificationService";

const serialize = (n: InstanceType<typeof Notification>, userId: string) => ({
  id: n._id,
  title: n.title,
  message: n.message,
  type: n.type,
  link: n.link ?? null,
  isRead: n.readBy.includes(userId),
  createdAt: n.createdAt,
});

/**
 * @route GET /api/notifications?unread=true&limit=50
 */
export const listNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    if (req.user!.role === "STUDENT" && req.user!.studentId) await ensureAssignmentReminders(req.user!.studentId);
    const filter: Record<string, unknown> = await visibilityFilter(req);
    if (req.query.unread === "true") filter.readBy = { $ne: userId };
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const [items, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ ...(await visibilityFilter(req)), readBy: { $ne: userId } }),
    ]);
    return sendResponse({ res, data: { notifications: items.map((n) => serialize(n, userId)), unread } });
  } catch (error) {
    console.error("[Notifications API] list:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load notifications" });
  }
};

/**
 * @route GET /api/notifications/unread-count
 */
export const unreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await Notification.countDocuments({ ...(await visibilityFilter(req)), readBy: { $ne: req.user!._id } });
    return sendResponse({ res, data: { unread: count } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to count notifications" });
  }
};

/**
 * @route PATCH /api/notifications/:id/read   (only notifications visible to the caller)
 */
export const markRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Notification not found" });
    const result = await Notification.updateOne(
      { _id: req.params.id, ...(await visibilityFilter(req)) },
      { $addToSet: { readBy: req.user!._id } }
    );
    if (result.matchedCount === 0) return sendResponse({ res, statusCode: 404, error: "Notification not found" });
    return sendResponse({ res, message: "Marked as read" });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update notification" });
  }
};

/**
 * @route POST /api/notifications/read-all
 */
export const markAllRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await Notification.updateMany(
      { ...(await visibilityFilter(req)), readBy: { $ne: req.user!._id } },
      { $addToSet: { readBy: req.user!._id } }
    );
    return sendResponse({ res, message: `Marked ${result.modifiedCount} notification(s) as read` });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update notifications" });
  }
};

/**
 * @desc   Admin broadcast (system announcement) to a role or everyone
 * @route  POST /api/admin/notifications  { title, message, recipientRole }
 */
export const adminBroadcast = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, message, recipientRole } = req.body ?? {};
    const role = recipientRole ?? "ALL";
    if (!["ALL", "STUDENT", "TEACHER", "ADMIN"].includes(role)) {
      return sendResponse({ res, statusCode: 400, error: "recipientRole must be ALL, STUDENT, TEACHER or ADMIN." });
    }
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    if (cleanTitle.length < 3 || cleanTitle.length > 140) return sendResponse({ res, statusCode: 400, error: "Title must be 3–140 characters." });
    if (cleanMessage.length < 3 || cleanMessage.length > 1000) return sendResponse({ res, statusCode: 400, error: "Message must be 3–1000 characters." });
    const n = await Notification.create({
      title: cleanTitle,
      message: cleanMessage,
      recipientRole: role,
      type: "SYSTEM",
      metadata: { broadcastBy: req.user!._id, generated: true },
    });
    return sendResponse({ res, statusCode: 201, message: "Announcement sent", data: { id: n._id } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to send announcement" });
  }
};
