import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { listNotifications, unreadCount, markRead, markAllRead } from "../controllers/notificationController";

// Every role reads its own notifications; visibility is enforced in the controller
const router = Router();
router.use(authenticate);
router.get("/", listNotifications);
router.get("/unread-count", unreadCount);
router.post("/read-all", markAllRead);
router.patch("/:id/read", markRead);

export default router;
