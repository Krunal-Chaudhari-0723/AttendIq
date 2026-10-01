"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// Accounts are created by administrators (Students / Teachers pages); there is no public sign-up.
// Brute-force protection per account and client address
const loginLimiter = (0, rateLimit_1.rateLimit)({
    name: "login",
    windowMs: 15 * 60000,
    max: 10,
    key: (req) => `${req.ip}:${String(req.body?.email ?? "").toLowerCase().trim()}`,
});
router.post("/auth/login", loginLimiter, authController_1.login);
router.post("/auth/logout", authController_1.logout);
router.get("/auth/me", authMiddleware_1.authenticate, authController_1.getMe);
exports.default = router;
