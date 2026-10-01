import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimit";
import { getProfile, updateProfile, changePassword } from "../controllers/profileController";

// Self-service profile for every role (the session decides whose profile)
const router = Router();
router.use(authenticate);
router.get("/", getProfile);
router.patch("/", updateProfile);
router.post("/password", rateLimit({ name: "password", windowMs: 15 * 60_000, max: 5 }), changePassword);

export default router;
