import { Router } from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  getTeacherDashboard,
  getTeacherClasses,
  getTeacherStudents,
  getTeacherAttendance,
  recordQuizResult,
  recordAssignment,
} from "../controllers/teacherController";
import { getClassRisk, getStudentInsights } from "../controllers/riskController";
import { teacherAttendanceReport, teacherPerformanceReport } from "../controllers/reportController";
import { rateLimit } from "../middleware/rateLimit";
import { listClassRecommendations, generateForStudent, getStudentRecommendationHistory } from "../controllers/recommendationController";
import { getClassEngagement, getSessionParticipation, rateParticipation } from "../controllers/engagementController";
import { getSessionOptions, startSession, endSession, listSessions, getSessionLive, manualMark } from "../controllers/sessionController";

const router = Router();

// Teacher routes act on the signed-in teacher's own profile; admins use /api/admin endpoints
router.use(authenticate, authorize("TEACHER"));

router.get("/dashboard", getTeacherDashboard);
router.get("/classes", getTeacherClasses);
router.get("/students", getTeacherStudents);
router.get("/attendance", getTeacherAttendance);
router.post("/quiz-results", recordQuizResult);
router.post("/assignments", recordAssignment);
router.get("/risk-analysis", authorize("TEACHER"), getClassRisk);
router.get("/students/:studentId/insights", authorize("TEACHER"), getStudentInsights);
router.get("/recommendations", authorize("TEACHER"), listClassRecommendations);
router.get("/reports/attendance", teacherAttendanceReport);
router.get("/reports/performance", teacherPerformanceReport);
router.get("/students/:studentId/recommendations", authorize("TEACHER"), getStudentRecommendationHistory);
router.post(
  "/students/:studentId/recommendations",
  authorize("TEACHER"),
  rateLimit({ name: "recommendations", windowMs: 60_000, max: 10 }),
  generateForStudent
);
router.get("/engagement", authorize("TEACHER"), getClassEngagement);
router.get("/sessions/:id/participation", authorize("TEACHER"), getSessionParticipation);
router.put("/sessions/:id/participation", authorize("TEACHER"), rateParticipation);

// Attendance sessions (teacher accounts only; admins have no teacher profile)
router.get("/sessions/options", authorize("TEACHER"), getSessionOptions);
router.get("/sessions", authorize("TEACHER"), listSessions);
router.post("/sessions", authorize("TEACHER"), startSession);
router.post("/sessions/:id/end", authorize("TEACHER"), endSession);
router.get("/sessions/:id/live", authorize("TEACHER"), getSessionLive);
router.post("/sessions/:id/manual", authorize("TEACHER"), manualMark);

export default router;
