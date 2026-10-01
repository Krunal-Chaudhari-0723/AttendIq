import { Response } from "express";
import mongoose from "mongoose";
import { Class, Student, IStudent } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent, getAuthenticatedTeacher } from "../utils/actor";
import { RISK_CONFIG } from "../config/analytics";
import { computeRiskWithTrend, riskDirection, saveRiskSnapshots, RiskResult } from "../services/riskService";
import { computeEngagementHistory } from "../services/engagementService";
import { getTeacherClassIds } from "./sessionController";
import { resolveTeacherScope, engagementMethodology } from "./engagementController";

const LEVEL_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };

export const riskMethodology = () => ({
  disclaimer: "This is a risk indicator based on recorded signals, not a prediction of academic outcomes.",
  levels: {
    HIGH: `${RISK_CONFIG.levels.high.minPoints}+ points`,
    MEDIUM: `${RISK_CONFIG.levels.medium.minPoints}–${RISK_CONFIG.levels.high.minPoints - 1} points`,
    LOW: `0–${RISK_CONFIG.levels.medium.minPoints - 1} points`,
  },
  rules: [
    `Attendance below ${RISK_CONFIG.attendance.criticalPercent}%: +${RISK_CONFIG.attendance.criticalPoints}; below ${RISK_CONFIG.attendance.requiredPercent}%: +${RISK_CONFIG.attendance.belowRequiredPoints}`,
    `Attendance dropped ${RISK_CONFIG.attendance.declinePercentPoints}+ points (last ${RISK_CONFIG.attendance.trendWindowDays} days vs previous): +${RISK_CONFIG.attendance.declinePoints}`,
    `Quiz average below ${RISK_CONFIG.quiz.failingPercent}%: +${RISK_CONFIG.quiz.failingPoints}; below ${RISK_CONFIG.quiz.lowPercent}%: +${RISK_CONFIG.quiz.lowPoints}`,
    `Assignment completion below ${RISK_CONFIG.assignments.poorCompletionPercent}%: +${RISK_CONFIG.assignments.poorPoints}; below ${RISK_CONFIG.assignments.lowCompletionPercent}%: +${RISK_CONFIG.assignments.lowPoints}`,
    `Engagement below ${RISK_CONFIG.engagement.veryLowScore}: +${RISK_CONFIG.engagement.veryLowPoints}; below ${RISK_CONFIG.engagement.lowScore}: +${RISK_CONFIG.engagement.lowPoints}; declining week-on-week: +${RISK_CONFIG.engagement.decliningPoints}`,
    `Participation below ${RISK_CONFIG.participation.lowScore}/100: +${RISK_CONFIG.participation.points}`,
  ],
});

const serializeRisk = (r: RiskResult, previous?: { level: RiskResult["level"]; points: number }) => ({
  level: r.level ?? "UNKNOWN",
  points: r.points,
  factors: r.factors,
  strengths: r.strengths,
  signals: r.signals,
  direction: riskDirection(r, previous),
  previousLevel: previous?.level ?? null,
});

const summarize = (rows: { risk: { level: string; direction: string } }[]) => ({
  high: rows.filter((r) => r.risk.level === "HIGH").length,
  medium: rows.filter((r) => r.risk.level === "MEDIUM").length,
  low: rows.filter((r) => r.risk.level === "LOW").length,
  unknown: rows.filter((r) => r.risk.level === "UNKNOWN").length,
  rising: rows.filter((r) => r.risk.direction === "RISING").length,
});

/**
 * @route GET /api/teacher/risk-analysis?classId=&subjectId=&level=
 */
export const getClassRisk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveTeacherScope(req, res);
    if (!scope) return;
    const { students, subjectIds, filters } = scope;
    const { results, previousLevels } = await computeRiskWithTrend(
      students.map((s) => s.studentId),
      { subjectIds }
    );
    if (!subjectIds) await saveRiskSnapshots(results, students);

    let rows = students.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      rollNumber: s.rollNumber,
      className: s.className,
      risk: serializeRisk(results.get(s.studentId)!, previousLevels.get(s.studentId)),
    }));
    const summary = summarize(rows);
    const level = String(req.query.level || "").toUpperCase();
    if (["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(level)) rows = rows.filter((r) => r.risk.level === level);
    rows.sort((a, b) => LEVEL_ORDER[a.risk.level] - LEVEL_ORDER[b.risk.level] || b.risk.points - a.risk.points);

    return sendResponse({ res, data: { summary, students: rows, filters, methodology: riskMethodology() } });
  } catch (error) {
    console.error("[Risk API] class:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute risk analysis" });
  }
};

/**
 * @desc   Full engagement + risk profile of one student in the teacher's classes
 * @route  GET /api/teacher/students/:studentId/insights
 */
export const getStudentInsights = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return sendResponse({ res, statusCode: 403, error: "Teacher profile not found." });
    const student = await Student.findOne({ studentId: String(req.params.studentId).toUpperCase() });
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student not found" });
    const allowed = (await getTeacherClassIds(teacher)).map(String);
    if (!student.classId || !allowed.includes(String(student.classId))) {
      return sendResponse({ res, statusCode: 403, error: "This student is not in any of your classes." });
    }
    const payload = await buildInsights(student);
    return sendResponse({ res, data: payload });
  } catch (error) {
    console.error("[Risk API] insights:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load student insights" });
  }
};

export const buildInsights = async (student: IStudent) => {
  const ids = [student.studentId];
  const [{ results, engagement, engagementTrends, previousLevels }, history] = await Promise.all([
    computeRiskWithTrend(ids),
    computeEngagementHistory(ids),
  ]);
  const e = engagement.get(student.studentId)!;
  return {
    student: { studentId: student.studentId, name: student.name, rollNumber: student.rollNumber, className: student.className, email: student.email },
    engagement: {
      overallScore: e.overallScore,
      coverage: e.coverage,
      components: e.components,
      explanation: e.explanation,
      trend: engagementTrends.get(student.studentId),
      history: history.map((p) => ({ date: p.date, score: p.scores.get(student.studentId) ?? null })),
    },
    risk: serializeRisk(results.get(student.studentId)!, previousLevels.get(student.studentId)),
    methodology: { risk: riskMethodology(), engagement: engagementMethodology() },
  };
};

/**
 * @desc   Student's own academic standing — reasons and strengths, phrased supportively, no points
 * @route  GET /api/student/risk
 */
export const getMyRisk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    const { results, previousLevels } = await computeRiskWithTrend([student.studentId]);
    const r = results.get(student.studentId)!;
    await saveRiskSnapshots(results, [student]);
    const labels: Record<string, string> = {
      HIGH: "Needs attention",
      MEDIUM: "Some concerns",
      LOW: "On track",
      UNKNOWN: "Not enough data yet",
    };
    const level = r.level ?? "UNKNOWN";
    return sendResponse({
      res,
      data: {
        level,
        label: labels[level],
        areasToImprove: r.factors.map((f) => f.message),
        strengths: r.strengths,
        direction: riskDirection(r, previousLevels.get(student.studentId)),
        disclaimer: "This indicator is based on your recorded attendance, quizzes, assignments and engagement. It is meant to help you and your teachers act early, not to predict results.",
      },
    });
  } catch (error) {
    console.error("[Risk API] student:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute academic standing" });
  }
};

/**
 * @route GET /api/admin/analytics/risk?classId=
 */
export const getInstitutionRisk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classId } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = { status: "ACTIVE" };
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) return sendResponse({ res, statusCode: 400, error: "Invalid classId" });
      filter.classId = new mongoose.Types.ObjectId(classId);
    }
    const [students, classes] = await Promise.all([
      Student.find(filter),
      Class.find({ isActive: true }).select("name code division").sort({ name: 1 }),
    ]);
    const { results, previousLevels } = await computeRiskWithTrend(students.map((s) => s.studentId));
    await saveRiskSnapshots(results, students);

    const rows = students.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      className: s.className,
      classId: s.classId,
      risk: serializeRisk(results.get(s.studentId)!, previousLevels.get(s.studentId)),
    }));
    const byClass = classes.map((c) => {
      const members = rows.filter((r) => r.classId && String(r.classId) === String(c._id));
      return { classId: c._id, name: c.name, code: c.code, studentCount: members.length, ...summarize(members) };
    });
    const factorCounts = new Map<string, number>();
    for (const r of rows) for (const f of r.risk.factors) factorCounts.set(f.code, (factorCounts.get(f.code) || 0) + 1);

    return sendResponse({
      res,
      data: {
        summary: { studentCount: rows.length, ...summarize(rows) },
        byClass,
        topFactors: [...factorCounts.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
        atRisk: rows
          .filter((r) => r.risk.level === "HIGH" || r.risk.level === "MEDIUM")
          .sort((a, b) => b.risk.points - a.risk.points)
          .map(({ classId: _c, ...r }) => r),
        classes: classes.map((c) => ({ id: c._id, name: c.name, code: c.code })),
        methodology: riskMethodology(),
      },
    });
  } catch (error) {
    console.error("[Risk API] admin:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute risk analytics" });
  }
};
