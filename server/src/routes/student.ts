import { Router } from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimit";
import {
  getStudentDashboard,
  getStudentAttendance,
  getStudentPerformance,
} from "../controllers/studentController";
import { getFaceStatus, enrollFace, verifyFace } from "../controllers/faceController";
import { getMyRisk } from "../controllers/riskController";
import { studentReport } from "../controllers/reportController";
import { getMyRecommendations, generateMyRecommendations, completeRecommendationItem } from "../controllers/recommendationController";
import { getMyEngagement, logLearningActivity, getMySubjects } from "../controllers/engagementController";
import { getOpenSession, precheckAttendance, verifyAttendance, abortAttempt } from "../controllers/attendanceController";

const router = Router();

// Student routes only ever act on the signed-in student's own data
router.use(authenticate, authorize("STUDENT"));

router.get("/dashboard", getStudentDashboard);
router.get("/attendance", getStudentAttendance);
router.get("/performance", getStudentPerformance);

// Face identity (the signed-in student only — admins never handle biometric vectors)
const faceLimiter = rateLimit({ name: "face", windowMs: 60_000, max: 20 });
router.get("/face/status", authorize("STUDENT"), getFaceStatus);
router.post("/face/enroll", authorize("STUDENT"), faceLimiter, enrollFace);
router.post("/face/verify", authorize("STUDENT"), faceLimiter, verifyFace);

// Engagement intelligence (own data only)
router.get("/engagement", authorize("STUDENT"), getMyEngagement);
router.get("/subjects", authorize("STUDENT"), getMySubjects);
router.get("/risk", authorize("STUDENT"), getMyRisk);
router.get("/reports", authorize("STUDENT"), studentReport);
router.get("/recommendations", authorize("STUDENT"), getMyRecommendations);
router.post("/recommendations/generate", authorize("STUDENT"), generateMyRecommendations);
router.post("/recommendations/:id/items/:index/complete", authorize("STUDENT"), completeRecommendationItem);
router.post("/learning-activities", authorize("STUDENT"), rateLimit({ name: "activity", windowMs: 60_000, max: 10 }), logLearningActivity);

// Attendance verification pipeline (signed-in student only)
const attendanceLimiter = rateLimit({ name: "attendance", windowMs: 60_000, max: 15 });
router.get("/attendance-session", authorize("STUDENT"), getOpenSession);
router.post("/attendance/precheck", authorize("STUDENT"), attendanceLimiter, precheckAttendance);
router.post("/attendance/verify", authorize("STUDENT"), attendanceLimiter, verifyAttendance);
router.post("/attendance/attempts/:id/abort", authorize("STUDENT"), abortAttempt);

export default router;
