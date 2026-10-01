import { Response } from "express";
import mongoose from "mongoose";
import { CampusSettings, Class, FaceProfile, Student, Subject, Teacher, User } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent, getAuthenticatedTeacher } from "../utils/actor";
import { getTeacherClassIds } from "./sessionController";
import { ATTENDANCE_CONFIG, FACE_CONFIG, LIVENESS_CONFIG } from "../config/verification";
import { ENGAGEMENT_CONFIG, RISK_CONFIG } from "../config/analytics";
import { AI_CONFIG, isAiConfigured } from "../services/recommendationService";
import { config } from "../config/env";

const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}$/;

/**
 * @desc   Own profile for any role (identity comes from the session, never from the request)
 * @route  GET /api/profile
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!._id).select("name email role createdAt");
    if (!user) return sendResponse({ res, statusCode: 404, error: "Account not found" });
    const base = { name: user.name, email: user.email, role: user.role, memberSince: user.createdAt };

    if (user.role === "STUDENT") {
      const student = await getAuthenticatedStudent(req);
      if (!student) return sendResponse({ res, data: { ...base, student: null } });
      const [face, cls, subjects] = await Promise.all([
        FaceProfile.findOne({ studentId: student.studentId, isActive: true }).select("enrolledAt modelVersion"),
        student.classId ? Class.findById(student.classId).select("name division semester department") : null,
        student.classId ? Subject.find({ classId: student.classId }).populate("teacherId", "name").select("name code teacherId") : [],
      ]);
      return sendResponse({
        res,
        data: {
          ...base,
          student: {
            studentId: student.studentId,
            rollNumber: student.rollNumber,
            className: student.className,
            division: cls?.division,
            semester: cls?.semester,
            department: student.department,
            academicYear: student.academicYear,
            phone: student.phone ?? "",
            status: student.status,
            face: face ? { enrolled: true, enrolledAt: face.enrolledAt } : { enrolled: false },
            subjects: subjects.map((s) => ({ name: s.name, code: s.code, teacher: (s.teacherId as unknown as { name?: string })?.name ?? null })),
          },
        },
      });
    }

    if (user.role === "TEACHER") {
      const teacher = await getAuthenticatedTeacher(req);
      if (!teacher) return sendResponse({ res, data: { ...base, teacher: null } });
      const classIds = await getTeacherClassIds(teacher);
      const [classes, subjects] = await Promise.all([
        Class.find({ _id: { $in: classIds } }).select("name division semester"),
        Subject.find({ teacherId: teacher._id }).select("name code classId"),
      ]);
      return sendResponse({
        res,
        data: {
          ...base,
          teacher: {
            teacherId: teacher.teacherId,
            department: teacher.department,
            designation: teacher.designation,
            phone: teacher.phone ?? "",
            status: teacher.status,
            classes: classes.map((c) => ({ name: c.name, division: c.division, semester: c.semester })),
            subjects: subjects.map((s) => ({ name: s.name, code: s.code, className: classes.find((c) => c._id.equals(s.classId))?.name ?? "" })),
          },
        },
      });
    }

    return sendResponse({ res, data: base });
  } catch (error) {
    console.error("[Profile API] get:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load profile" });
  }
};

/**
 * @desc   Update self-editable fields (phone). Name, IDs, class and role are managed by administrators.
 * @route  PATCH /api/profile  { phone }
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone } = req.body ?? {};
    const clean = typeof phone === "string" ? phone.trim() : "";
    if (clean && !PHONE_RE.test(clean)) return sendResponse({ res, statusCode: 400, error: "Enter a valid phone number (digits, spaces, dashes, optional +)." });
    if (req.user!.role === "STUDENT") {
      const s = await getAuthenticatedStudent(req);
      if (!s) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
      await Student.updateOne({ _id: s._id }, clean ? { $set: { phone: clean } } : { $unset: { phone: 1 } });
    } else if (req.user!.role === "TEACHER") {
      const t = await getAuthenticatedTeacher(req);
      if (!t) return sendResponse({ res, statusCode: 404, error: "Teacher profile not found" });
      await Teacher.updateOne({ _id: t._id }, clean ? { $set: { phone: clean } } : { $unset: { phone: 1 } });
    } else {
      return sendResponse({ res, statusCode: 400, error: "No editable profile fields for this role." });
    }
    return sendResponse({ res, message: "Profile updated" });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update profile" });
  }
};

/**
 * @route POST /api/profile/password  { currentPassword, newPassword }
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return sendResponse({ res, statusCode: 400, error: "currentPassword and newPassword are required." });
    }
    if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return sendResponse({ res, statusCode: 400, error: "New password must be 8–128 characters and include letters and numbers." });
    }
    if (newPassword === currentPassword) return sendResponse({ res, statusCode: 400, error: "New password must be different from the current one." });
    const user = await User.findById(req.user!._id).select("+password");
    if (!user || !(await user.matchPassword(currentPassword))) {
      return sendResponse({ res, statusCode: 400, error: "Current password is incorrect." });
    }
    user.password = newPassword; // hashed by the pre-save hook
    await user.save();
    return sendResponse({ res, message: "Password changed successfully." });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to change password" });
  }
};

// =====================================================================
// Admin settings
// =====================================================================

/**
 * @desc   Editable attendance defaults + the effective (read-only) configuration of every engine
 * @route  GET /api/admin/settings
 */
export const getAdminSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campus = await CampusSettings.findOne();
    const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
    return sendResponse({
      res,
      data: {
        attendance: {
          defaultSessionMinutes: campus?.defaultSessionMinutes ?? ATTENDANCE_CONFIG.defaultSessionMinutes,
          defaultLateAfterMinutes: campus?.defaultLateAfterMinutes ?? ATTENDANCE_CONFIG.defaultLateAfterMinutes,
          minSessionMinutes: ATTENDANCE_CONFIG.minSessionMinutes,
          maxSessionMinutes: ATTENDANCE_CONFIG.maxSessionMinutes,
          attemptTtlSeconds: ATTENDANCE_CONFIG.attemptTtlMs / 1000,
          auditRetentionDays: ATTENDANCE_CONFIG.attemptRetentionDays,
        },
        campus: campus
          ? {
              name: campus.campusName,
              configured: campus.isConfigured,
              enforced: campus.isEnforced,
              radiusMeters: campus.radiusMeters,
              maxAccuracyMeters: campus.maxAccuracyMeters,
              allowedModes: campus.allowedModes,
            }
          : null,
        verification: {
          faceModel: FACE_CONFIG.modelVersion,
          matchThreshold: FACE_CONFIG.matchThreshold,
          livenessTurnThreshold: LIVENESS_CONFIG.turnMinAbsYaw,
          livenessCenterThreshold: LIVENESS_CONFIG.centerMaxAbsYaw,
        },
        analytics: {
          engagementWeights: ENGAGEMENT_CONFIG.weights,
          engagementWindowDays: ENGAGEMENT_CONFIG.windowDays,
          attendanceRequirementPercent: RISK_CONFIG.attendance.requiredPercent,
          riskLevels: RISK_CONFIG.levels,
        },
        ai: { configured: isAiConfigured(), model: isAiConfigured() ? AI_CONFIG.model : null },
        system: {
          environment: config.nodeEnv,
          database: dbStates[mongoose.connection.readyState] ?? "unknown",
          databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null,
        },
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to load settings" });
  }
};

/**
 * @route PUT /api/admin/settings/attendance  { defaultSessionMinutes, defaultLateAfterMinutes }
 */
export const updateAttendanceSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const minutes = Number(req.body?.defaultSessionMinutes);
    const late = Number(req.body?.defaultLateAfterMinutes);
    if (!Number.isInteger(minutes) || minutes < ATTENDANCE_CONFIG.minSessionMinutes || minutes > ATTENDANCE_CONFIG.maxSessionMinutes) {
      return sendResponse({ res, statusCode: 400, error: `Default duration must be ${ATTENDANCE_CONFIG.minSessionMinutes}–${ATTENDANCE_CONFIG.maxSessionMinutes} minutes.` });
    }
    if (!Number.isInteger(late) || late < 0 || late > minutes) {
      return sendResponse({ res, statusCode: 400, error: "Late threshold must be between 0 and the default duration." });
    }
    await CampusSettings.updateOne({}, { $set: { defaultSessionMinutes: minutes, defaultLateAfterMinutes: late } }, { upsert: true });
    return sendResponse({ res, message: "Attendance defaults saved." });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to save settings" });
  }
};
