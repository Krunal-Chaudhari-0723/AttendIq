import { Response } from "express";
import mongoose from "mongoose";
import { LearningActivity, Recommendation, Student, IRecommendation } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent, getAuthenticatedTeacher } from "../utils/actor";
import { getTeacherClassIds } from "./sessionController";
import { resolveTeacherScope } from "./engagementController";
import { AI_CONFIG, generateRecommendation, isAiConfigured } from "../services/recommendationService";
import { computeRiskBatch } from "../services/riskService";
import { notifyRecommendation } from "../services/notificationService";

const serialize = (r: IRecommendation, audience?: "STUDENT") => ({
  id: r._id,
  studentId: r.studentId,
  summary: r.summary,
  priority: r.priority,
  riskLevel: r.riskLevel,
  source: r.source,
  sourceLabel: r.source === "AI" ? "AI-generated" : "Rule-based",
  aiModel: r.aiModel,
  fallbackReason: r.fallbackReason,
  generatedAt: r.generatedAt,
  generatedByRole: r.generatedByRole,
  supportingFactors: r.supportingFactors,
  recommendations: r.recommendations
    .map((item, index) => ({
      index,
      action: item.action,
      description: item.description,
      priority: item.priority,
      category: item.category,
      audience: item.audience,
      supportingFactors: item.supportingFactors,
      completedAt: item.completedAt ?? null,
    }))
    // Students see actions addressed to them; teacher-only actions stay with staff
    .filter((item) => audience !== "STUDENT" || item.audience === "STUDENT"),
});

const aiStatus = () => ({ aiConfigured: isAiConfigured(), model: isAiConfigured() ? AI_CONFIG.model : null });

const ensureTeacherOwnsStudent = async (req: AuthenticatedRequest, res: Response) => {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) {
    sendResponse({ res, statusCode: 403, error: "Teacher profile not found." });
    return null;
  }
  const student = await Student.findOne({ studentId: String(req.params.studentId).toUpperCase() });
  if (!student) {
    sendResponse({ res, statusCode: 404, error: "Student not found" });
    return null;
  }
  const allowed = (await getTeacherClassIds(teacher)).map(String);
  if (!student.classId || !allowed.includes(String(student.classId))) {
    sendResponse({ res, statusCode: 403, error: "This student is not in any of your classes." });
    return null;
  }
  return { teacher, student };
};

/**
 * @desc   Students in the teacher's classes with risk level + their latest recommendation
 * @route  GET /api/teacher/recommendations?classId=
 */
export const listClassRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveTeacherScope(req, res);
    if (!scope) return;
    const ids = scope.students.map((s) => s.studentId);
    const [{ results }, recs] = await Promise.all([
      computeRiskBatch(ids),
      Recommendation.find({ studentId: { $in: ids }, isActive: true }),
    ]);
    const recMap = new Map(recs.map((r) => [r.studentId, r]));
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };
    const rows = scope.students
      .map((s) => {
        const risk = results.get(s.studentId)!;
        const rec = recMap.get(s.studentId);
        return {
          studentId: s.studentId,
          name: s.name,
          className: s.className,
          riskLevel: risk.level ?? "UNKNOWN",
          topReason: risk.factors[0]?.message ?? null,
          recommendation: rec ? serialize(rec) : null,
        };
      })
      .sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
    return sendResponse({ res, data: { students: rows, filters: scope.filters, ...aiStatus() } });
  } catch (error) {
    console.error("[Recommendations API] list:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load recommendations" });
  }
};

/**
 * @desc   Generate a fresh recommendation for one student (AI when configured, otherwise rule-based)
 * @route  POST /api/teacher/students/:studentId/recommendations  { mode?: "auto" | "rule" }
 */
export const generateForStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const owned = await ensureTeacherOwnsStudent(req, res);
    if (!owned) return;
    const mode = req.body?.mode === "rule" ? "rule" : "auto";
    const doc = await generateRecommendation(owned.student, {
      generatedByRole: "TEACHER",
      generatedBy: String(owned.teacher._id),
      preferAi: mode === "auto",
    });
    void notifyRecommendation(owned.student.studentId, doc.source, String(doc._id));
    return sendResponse({
      res,
      statusCode: 201,
      message: doc.source === "AI" ? "AI recommendations generated." : "Rule-based recommendations generated.",
      data: serialize(doc),
    });
  } catch (error) {
    console.error("[Recommendations API] generate:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to generate recommendations" });
  }
};

/**
 * @route GET /api/teacher/students/:studentId/recommendations  (history, newest first)
 */
export const getStudentRecommendationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const owned = await ensureTeacherOwnsStudent(req, res);
    if (!owned) return;
    const recs = await Recommendation.find({ studentId: owned.student.studentId }).sort({ generatedAt: -1 }).limit(10);
    return sendResponse({ res, data: { recommendations: recs.map((r) => serialize(r)), ...aiStatus() } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to load recommendation history" });
  }
};

/**
 * @route GET /api/student/recommendations  (own, latest active; student-addressed actions only)
 */
export const getMyRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    const rec = await Recommendation.findOne({ studentId: student.studentId, isActive: true }).sort({ generatedAt: -1 });
    return sendResponse({ res, data: { recommendation: rec ? serialize(rec, "STUDENT") : null, ...aiStatus() } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to load recommendations" });
  }
};

/**
 * @desc   Student refreshes their own recommendations (at most once every 10 minutes)
 * @route  POST /api/student/recommendations/generate
 */
export const generateMyRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    const latest = await Recommendation.findOne({ studentId: student.studentId }).sort({ generatedAt: -1 });
    if (latest && Date.now() - latest.generatedAt.getTime() < 10 * 60 * 1000) {
      return sendResponse({ res, statusCode: 429, error: "Recommendations were refreshed recently. Try again in a few minutes." });
    }
    const doc = await generateRecommendation(student, { generatedByRole: "STUDENT", generatedBy: req.user?._id });
    return sendResponse({ res, statusCode: 201, data: { recommendation: serialize(doc, "STUDENT") } });
  } catch (error) {
    console.error("[Recommendations API] student generate:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to generate recommendations" });
  }
};

/**
 * @desc   Student marks one of their own actions as done (counts as learning activity)
 * @route  POST /api/student/recommendations/:id/items/:index/complete
 */
export const completeRecommendationItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Recommendation not found" });
    const rec = await Recommendation.findOne({ _id: req.params.id, studentId: student.studentId });
    if (!rec) return sendResponse({ res, statusCode: 404, error: "Recommendation not found" });
    const index = Number(req.params.index);
    const item = Number.isInteger(index) ? rec.recommendations[index] : undefined;
    if (!item || item.audience !== "STUDENT") return sendResponse({ res, statusCode: 404, error: "Action not found" });
    if (item.completedAt) return sendResponse({ res, statusCode: 409, error: "Action already marked as done." });

    item.completedAt = new Date();
    await rec.save();
    await LearningActivity.create({
      student: student._id,
      studentId: student.studentId,
      type: "RECOMMENDATION_ACTION",
      title: `Completed: ${item.action}`.slice(0, 120),
      minutes: 30,
      recommendationId: rec._id,
      occurredAt: new Date(),
    });
    return sendResponse({ res, message: "Marked as done.", data: serialize(rec, "STUDENT") });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to update action" });
  }
};
