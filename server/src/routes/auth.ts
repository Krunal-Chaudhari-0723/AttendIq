import { Router } from "express";
import { login, logout, getMe } from "../controllers/authController";
import { authenticate } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

// Accounts are created by administrators (Students / Teachers pages); there is no public sign-up.
// Brute-force protection per account and client address
const loginLimiter = rateLimit({
  name: "login",
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email ?? "").toLowerCase().trim()}`,
});
router.post("/auth/login", loginLimiter, login);
router.post("/auth/logout", logout);
router.get("/auth/me", authenticate, getMe);

export default router;
