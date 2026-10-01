import { Response } from "express";
import mongoose from "mongoose";
import { Class, Student, Subject } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent, getAuthenticatedTeacher } from "../utils/actor";
import { getTeacherClassIds } from "./sessionController";
import {
  ATTENDANCE_CSV_COLUMNS,
  buildAttendanceReport,
  buildPerformanceReport,
  parseDateRange,
  toCsv,
} from "../services/reportService";

const oid = (v: unknown) => (typeof v === "string" && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

const sendCsv = (res: Response, filename: string, csv: string) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(`﻿${csv}`);
};

const stamp = (from: Date, to: Date) => `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}`;

// =====================================================================
// ADMIN — whole institution
// =====================================================================

/**
 * @route GET /api/admin/reports/attendance?from=&to=&classId=&subjectId=&studentId=&format=csv
 */
export const adminAttendanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query);
    if ("error" in range) return sendResponse({ res, statusCode: 400, error: range.error });
    const { classId, subjectId, studentId, format } = req.query as Record<string, string | undefined>;
    if (classId && !oid(classId)) return sendResponse({ res, statusCode: 400, error: "Invalid classId" });
    if (subjectId && !oid(subjectId)) return sendResponse({ res, statusCode: 400, error: "Invalid subjectId" });

    const report = await buildAttendanceReport({
      ...range,
      classIds: classId ? [oid(classId)!] : undefined,
      subjectIds: subjectId ? [oid(subjectId)!] : undefined,
      studentIds: studentId ? [studentId.toUpperCase()] : undefined,
    });
    if (format === "csv") return sendCsv(res, `attendance_${stamp(range.from, range.to)}.csv`, toCsv(report.byStudent, ATTENDANCE_CSV_COLUMNS));

    const [classes, subjects] = await Promise.all([
      Class.find({ isActive: true }).select("name code division").sort({ name: 1 }),
      Subject.find().select("name code classId").sort({ name: 1 }),
    ]);
    return sendResponse({
      res,
      data: {
        ...report,
        filters: {
          classes: classes.map((c) => ({ id: c._id, name: c.name, division: c.division })),
          subjects: subjects.map((s) => ({ id: s._id, name: s.name, classId: s.classId })),
        },
      },
    });
  } catch (error) {
    console.error("[Reports API] admin attendance:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to build attendance report" });
  }
};

/**
 * @route GET /api/admin/reports/performance?from=&to=&classId=&format=csv
 */
export const adminPerformanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query);
    if ("error" in range) return sendResponse({ res, statusCode: 400, error: range.error });
    const { classId, subjectId, format } = req.query as Record<string, string | undefined>;
    if (classId && !oid(classId)) return sendResponse({ res, statusCode: 400, error: "Invalid classId" });
    if (subjectId && !oid(subjectId)) return sendResponse({ res, statusCode: 400, error: "Invalid subjectId" });
    const students = await Student.find({ status: "ACTIVE", ...(classId ? { classId: oid(classId) } : {}) }).select("studentId");
    const report = await buildPerformanceReport({
      ...range,
      studentIds: students.map((s) => s.studentId),
      subjectIds: subjectId ? [oid(subjectId)!] : undefined,
    });
    if (format === "csv") {
      return sendCsv(res, `performance_${stamp(range.from, range.to)}.csv`, toCsv(report.byStudent, PERFORMANCE_CSV_COLUMNS));
    }
    const [classes, subjects] = await Promise.all([
      Class.find({ isActive: true }).select("name division").sort({ name: 1 }),
      Subject.find().select("name classId").sort({ name: 1 }),
    ]);
    return sendResponse({
      res,
      data: {
        range,
        ...report,
        filters: {
          classes: classes.map((c) => ({ id: c._id, name: c.name, division: c.division })),
          subjects: subjects.map((x) => ({ id: x._id, name: x.name, classId: x.classId })),
        },
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to build performance report" });
  }
};

const PERFORMANCE_CSV_COLUMNS = [
  { key: "studentId", label: "Student ID" },
  { key: "name", label: "Name" },
  { key: "className", label: "Class" },
  { key: "quizCount", label: "Quizzes" },
  { key: "quizAverage", label: "Quiz Average %" },
  { key: "assignmentsDue", label: "Assignments Due" },
  { key: "assignmentsSubmitted", label: "Assignments Submitted" },
  { key: "completionRate", label: "Completion %" },
  { key: "gradeAverage", label: "Grade Average %" },
];

// =====================================================================
// TEACHER — sessions they ran / students in their classes
// =====================================================================

const teacherScope = async (req: AuthenticatedRequest, res: Response) => {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) {
    sendResponse({ res, statusCode: 403, error: "Teacher profile not found." });
    return null;
  }
  const allowed = await getTeacherClassIds(teacher);
  const { classId, subjectId } = req.query as Record<string, string | undefined>;
  let classIds = allowed;
  if (classId) {
    if (!allowed.some((c) => String(c) === classId)) {
      sendResponse({ res, statusCode: 403, error: "You are not assigned to this class." });
      return null;
    }
    classIds = [new mongoose.Types.ObjectId(classId)];
  }
  const mySubjects = await Subject.find({ teacherId: teacher._id, classId: { $in: allowed } }).select("name code classId");
  let subjectIds: mongoose.Types.ObjectId[] | undefined;
  if (subjectId) {
    const s = mySubjects.find((x) => String(x._id) === subjectId);
    if (!s) {
      sendResponse({ res, statusCode: 403, error: "You can only report on subjects you teach." });
      return null;
    }
    subjectIds = [s._id as mongoose.Types.ObjectId];
  }
  const classes = await Class.find({ _id: { $in: allowed } }).select("name division").sort({ name: 1 });
  return {
    teacher,
    classIds,
    subjectIds,
    filters: {
      classes: classes.map((c) => ({ id: c._id, name: c.name, division: c.division })),
      subjects: mySubjects.map((s) => ({ id: s._id, name: s.name, classId: s.classId })),
    },
  };
};

/**
 * @route GET /api/teacher/reports/attendance?from=&to=&classId=&subjectId=&format=csv
 */
export const teacherAttendanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query);
    if ("error" in range) return sendResponse({ res, statusCode: 400, error: range.error });
    const scope = await teacherScope(req, res);
    if (!scope) return;
    const report = await buildAttendanceReport({
      ...range,
      classIds: scope.classIds,
      subjectIds: scope.subjectIds,
      teacherIds: [scope.teacher._id as mongoose.Types.ObjectId],
    });
    if (req.query.format === "csv") return sendCsv(res, `attendance_${stamp(range.from, range.to)}.csv`, toCsv(report.byStudent, ATTENDANCE_CSV_COLUMNS));
    return sendResponse({ res, data: { ...report, byTeacher: undefined, filters: scope.filters } });
  } catch (error) {
    console.error("[Reports API] teacher attendance:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to build attendance report" });
  }
};

/**
 * @route GET /api/teacher/reports/performance?from=&to=&classId=&subjectId=&format=csv
 */
export const teacherPerformanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query);
    if ("error" in range) return sendResponse({ res, statusCode: 400, error: range.error });
    const scope = await teacherScope(req, res);
    if (!scope) return;
    const students = await Student.find({ classId: { $in: scope.classIds }, status: "ACTIVE" }).select("studentId");
    // Without a subject filter, limit to subjects this teacher teaches
    const subjectIds = scope.subjectIds ?? scope.filters.subjects.map((s) => s.id as mongoose.Types.ObjectId);
    const report = await buildPerformanceReport({ ...range, studentIds: students.map((s) => s.studentId), subjectIds });
    if (req.query.format === "csv") return sendCsv(res, `performance_${stamp(range.from, range.to)}.csv`, toCsv(report.byStudent, PERFORMANCE_CSV_COLUMNS));
    return sendResponse({ res, data: { range, ...report, filters: scope.filters } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to build performance report" });
  }
};

// =====================================================================
// STUDENT — own data only
// =====================================================================

/**
 * @route GET /api/student/reports?from=&to=
 */
export const studentReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const range = parseDateRange(req.query);
    if ("error" in range) return sendResponse({ res, statusCode: 400, error: range.error });
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    const [attendance, performance] = await Promise.all([
      buildAttendanceReport({ ...range, studentIds: [student.studentId], classIds: student.classId ? [student.classId] : [] }),
      buildPerformanceReport({ ...range, studentIds: [student.studentId] }),
    ]);
    return sendResponse({
      res,
      data: {
        range,
        attendance: { summary: attendance.summary, byDay: attendance.byDay, bySubject: attendance.bySubject },
        performance: { bySubject: performance.bySubject, overall: performance.byStudent[0] ?? null },
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to build report" });
  }
};
