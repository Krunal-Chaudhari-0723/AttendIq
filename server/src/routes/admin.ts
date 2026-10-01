import { Router } from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  getAdminStats,
  getStudentById,
  updateFaceStatus,
  getCampusSettings,
  updateCampusSettings,
} from "../controllers/adminController";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAcademicYears,
  createAcademicYear,
  activateAcademicYear,
} from "../controllers/adminCrudController";
import { adminBroadcast } from "../controllers/notificationController";
import { getAdminSettings, updateAttendanceSettings } from "../controllers/profileController";

import { getInstitutionEngagement } from "../controllers/engagementController";
import { getInstitutionRisk } from "../controllers/riskController";
import { adminAttendanceReport, adminPerformanceReport } from "../controllers/reportController";

const router = Router();

// Protect ALL admin routes with authenticate & authorize("ADMIN")
router.use(authenticate, authorize("ADMIN"));

// KPIs & Analytics
router.get("/stats", getAdminStats);

// Students CRUD
router.get("/students", getStudents);
router.get("/students/:id", getStudentById);
router.post("/students", createStudent);
router.put("/students/:id", updateStudent);
router.patch("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);
router.patch("/students/:id/face-status", updateFaceStatus);

// Teachers CRUD
router.get("/teachers", getTeachers);
router.get("/teachers/:id", getTeacherById);
router.post("/teachers", createTeacher);
router.put("/teachers/:id", updateTeacher);
router.patch("/teachers/:id", updateTeacher);
router.delete("/teachers/:id", deleteTeacher);

// Classes CRUD
router.get("/classes", getClasses);
router.get("/classes/:id", getClassById);
router.post("/classes", createClass);
router.put("/classes/:id", updateClass);
router.patch("/classes/:id", updateClass);
router.delete("/classes/:id", deleteClass);

// Subjects CRUD
router.get("/subjects", getSubjects);
router.post("/subjects", createSubject);
router.put("/subjects/:id", updateSubject);
router.patch("/subjects/:id", updateSubject);
router.delete("/subjects/:id", deleteSubject);

// Academic Years CRUD
router.get("/academic-years", getAcademicYears);
router.post("/academic-years", createAcademicYear);
router.patch("/academic-years/:id/activate", activateAcademicYear);

// Campus & Attendance Settings
router.get("/campus-settings", getCampusSettings);
router.put("/campus-settings", updateCampusSettings);
router.get("/settings", getAdminSettings);
router.put("/settings/attendance", updateAttendanceSettings);

// Analytics
router.get("/analytics/engagement", getInstitutionEngagement);
router.get("/analytics/risk", getInstitutionRisk);
router.get("/reports/attendance", adminAttendanceReport);
router.get("/reports/performance", adminPerformanceReport);

// Notifications
router.post("/notifications", adminBroadcast);

export default router;
