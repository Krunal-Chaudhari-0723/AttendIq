import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  Student,
  Teacher,
  Class,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  EngagementScore,
  RiskAssessment,
  CampusSettings,
  AcademicYear,
  Notification,
  User,
  FaceProfile,
} from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { refreshSessionStatuses } from "../services/sessionService";
import { buildAttendanceReport } from "../services/reportService";
import { computeRiskBatch, saveRiskSnapshots } from "../services/riskService";

/**
 * @desc Get real database-driven Admin dashboard KPIs and analytics
 * @route GET /api/admin/stats
 * @access Admin only
 */
export const getAdminStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await refreshSessionStatuses();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [totalStudents, totalTeachers, totalClasses, totalSubjects, faceEnrolled, activeSessions, students] = await Promise.all([
      Student.countDocuments({ status: "ACTIVE" }),
      Teacher.countDocuments({ status: "ACTIVE" }),
      Class.countDocuments({ isActive: true }),
      Subject.countDocuments(),
      Student.countDocuments({ status: "ACTIVE", isFaceEnrolled: true }),
      AttendanceSession.find({ status: "ACTIVE" }).select("subjectName className room mode teacherName startTime endTime"),
      Student.find({ status: "ACTIVE" }),
    ]);

    // Last 14 days of real attendance, plus today
    const report = await buildAttendanceReport({ from: new Date(dayStart.getTime() - 13 * 24 * 60 * 60 * 1000), to: now });
    const today = report.byDay.find((d) => d.date === dayStart.toISOString().slice(0, 10)) ?? null;

    const { results, engagement } = await computeRiskBatch(students.map((s) => s.studentId));
    await saveRiskSnapshots(results, students);
    const riskMap = { LOW: 0, MEDIUM: 0, HIGH: 0, UNKNOWN: 0 };
    for (const r of results.values()) riskMap[r.level ?? "UNKNOWN"]++;
    const scores = [...engagement.values()].map((e) => e.overallScore).filter((x): x is number => x !== null);
    const byId = new Map(students.map((s) => [s.studentId, s]));
    const topAtRisk = [...results.values()]
      .filter((r) => r.level === "HIGH" || r.level === "MEDIUM")
      .sort((a, b) => b.points - a.points)
      .slice(0, 8)
      .map((r) => ({
        id: r.studentId,
        name: byId.get(r.studentId)?.name ?? r.studentId,
        class: byId.get(r.studentId)?.className ?? "",
        attendance: r.signals.attendanceRate === null ? "—" : `${r.signals.attendanceRate}%`,
        risk: r.level,
        reason: r.factors[0]?.message ?? "",
      }));

    return sendResponse({
      res,
      data: {
        kpis: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalSubjects,
          faceEnrolled,
          todayAttendance: today?.attendanceRate != null ? `${today.attendanceRate}%` : "—",
          todayAttendanceNote: today ? `${today.present + today.late} of ${today.counted} marked records` : "No attendance recorded today",
          periodAttendance: report.summary.attendanceRate,
          activeSessionsCount: activeSessions.length,
          studentsAtRisk: riskMap.HIGH + riskMap.MEDIUM,
          overallEngagement: scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)} / 100` : "—",
        },
        activeSessions,
        riskDistribution: { low: riskMap.LOW, medium: riskMap.MEDIUM, high: riskMap.HIGH, unknown: riskMap.UNKNOWN },
        attendanceTrend: report.byDay.map((d) => ({ date: d.date, rate: d.attendanceRate, count: `${d.present + d.late}/${d.counted}` })),
        topAtRiskStudents: topAtRisk,
      },
    });
  } catch (error) {
    console.error("[Admin API] Failed to fetch stats:", error);
    return sendResponse({ res, statusCode: 500, error: "Could not fetch administrative dashboard statistics." });
  }
};

// ==========================================
// 1. STUDENT MANAGEMENT
// ==========================================


export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { studentId: id.toUpperCase() };

    const student = await Student.findOne(query).populate("classId");
    if (!student) {
      return sendResponse({ res, statusCode: 404, error: "Student not found" });
    }

    // Load related academic signals
    const [{ results, engagement: engagementMap }, records, faceProfile] = await Promise.all([
      computeRiskBatch([student.studentId]),
      AttendanceRecord.find({ studentId: student.studentId })
        .populate("sessionId", "subjectName startTime mode")
        .sort({ markedAt: -1 })
        .limit(10),
      FaceProfile.findOne({ studentId: student.studentId }).select("modelVersion enrolledAt isActive"),
    ]);

    return sendResponse({
      res,
      data: {
        student,
        engagement: (() => {
          const e = engagementMap.get(student.studentId)!;
          return {
            overallScore: e.overallScore,
            components: Object.fromEntries(Object.entries(e.components).map(([k, c]) => [k, c.score])),
          };
        })(),
        risk: (() => {
          const r = results.get(student.studentId)!;
          return { riskLevel: r.level ?? "UNKNOWN", reasons: r.factors.map((f) => f.message), attendanceRate: r.signals.attendanceRate };
        })(),
        attendanceHistory: records,
        faceProfile: faceProfile ? { enrolled: true, enrolledAt: faceProfile.enrolledAt, modelVersion: faceProfile.modelVersion } : { enrolled: false },
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch student details" });
  }
};




export const updateFaceStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isFaceEnrolled, reAuthorize } = req.body;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { studentId: id.toUpperCase() };

    const student = await Student.findOne(query);
    if (!student) {
      return sendResponse({ res, statusCode: 404, error: "Student not found" });
    }

    if (reAuthorize) {
      // Clear face profile to allow re-enrollment
      await FaceProfile.deleteOne({ studentId: student.studentId });
      student.isFaceEnrolled = false;
      student.faceProfileId = undefined;
      await student.save();
      return sendResponse({ res, message: `Re-enrollment authorized for ${student.name}. Previous embedding purged.` });
    }

    // Enrollment can only be *created* by the student with a live camera.
    // Admins may only revoke it (purge), never mark a student as enrolled.
    if (isFaceEnrolled === false || isFaceEnrolled === "false") {
      await FaceProfile.deleteOne({ studentId: student.studentId });
      student.isFaceEnrolled = false;
      student.faceProfileId = undefined;
      await student.save();
      return sendResponse({ res, message: `Face enrollment revoked for ${student.name}.`, data: student });
    }

    return sendResponse({
      res,
      statusCode: 400,
      error: "Only re-authorization (purge) is supported. Students enroll their face themselves with a live camera.",
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to update face status" });
  }
};

// ==========================================
// 2. TEACHER MANAGEMENT
// ==========================================






// ==========================================
// 3. CLASS / DIVISION MANAGEMENT
// ==========================================






// ==========================================
// 4. SUBJECT MANAGEMENT
// ==========================================





// ==========================================
// 5. ACADEMIC YEAR MANAGEMENT
// ==========================================




// ==========================================
// 6. CAMPUS & ATTENDANCE SETTINGS
// ==========================================

export const getCampusSettings = async (req: Request, res: Response) => {
  try {
    let settings = await CampusSettings.findOne();
    if (!settings) {
      settings = await CampusSettings.create({
        campusName: "AttendIQ Central Campus",
        latitude: 23.0225,
        longitude: 72.5714,
        radiusMeters: 250,
        isEnforced: true,
        allowedModes: ["PHYSICAL", "REMOTE"],
      });
    }
    return sendResponse({ res, data: settings });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch campus settings" });
  }
};

export const updateCampusSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campusName, latitude, longitude, radiusMeters, maxAccuracyMeters, isEnforced, allowedModes } = req.body ?? {};

    const lat = Number(latitude);
    const lon = Number(longitude);
    const radius = Number(radiusMeters);
    if (latitude === undefined || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      return sendResponse({ res, statusCode: 400, error: "latitude must be a number between -90 and 90." });
    }
    if (longitude === undefined || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return sendResponse({ res, statusCode: 400, error: "longitude must be a number between -180 and 180." });
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
      return sendResponse({ res, statusCode: 400, error: "radiusMeters must be between 10 and 5000." });
    }
    let accuracyLimit: number | undefined;
    if (maxAccuracyMeters !== undefined) {
      accuracyLimit = Number(maxAccuracyMeters);
      if (!Number.isFinite(accuracyLimit) || accuracyLimit < 10 || accuracyLimit > 5000) {
        return sendResponse({ res, statusCode: 400, error: "maxAccuracyMeters must be between 10 and 5000." });
      }
    }
    let modes: ("PHYSICAL" | "REMOTE")[] | undefined;
    if (allowedModes !== undefined) {
      if (
        !Array.isArray(allowedModes) ||
        allowedModes.length === 0 ||
        allowedModes.some((m: unknown) => m !== "PHYSICAL" && m !== "REMOTE")
      ) {
        return sendResponse({ res, statusCode: 400, error: "allowedModes must contain PHYSICAL and/or REMOTE." });
      }
      modes = [...new Set(allowedModes as ("PHYSICAL" | "REMOTE")[])];
    }

    let settings = await CampusSettings.findOne();
    if (!settings) {
      settings = new CampusSettings();
    }

    if (typeof campusName === "string" && campusName.trim()) settings.campusName = campusName.trim().slice(0, 120);
    settings.latitude = lat;
    settings.longitude = lon;
    settings.radiusMeters = Math.round(radius);
    if (accuracyLimit !== undefined) settings.maxAccuracyMeters = Math.round(accuracyLimit);
    if (isEnforced !== undefined) settings.isEnforced = isEnforced === true || isEnforced === "true";
    if (modes) settings.allowedModes = modes;
    settings.isConfigured = true;
    if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
      settings.updatedBy = new mongoose.Types.ObjectId(req.user._id);
    }

    await settings.save();
    return sendResponse({ res, message: "Campus & Attendance parameters updated successfully", data: settings });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to update campus settings" });
  }
};
