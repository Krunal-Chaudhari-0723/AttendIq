import { Response } from "express";
import { Assignment, AttendanceRecord, AttendanceSession, QuizResult, Recommendation, Subject } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent } from "../utils/actor";
import { computeRiskBatch } from "../services/riskService";
import { computeEngagementWithTrend } from "../services/engagementService";
import { findOpenSessionForClass } from "../services/sessionService";

const notFound = (res: Response) => sendResponse({ res, statusCode: 404, error: "Student profile not found for this account." });
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

/**
 * @desc   Student dashboard — every number is computed from the student's own records
 * @route  GET /api/student/dashboard
 */
export const getStudentDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return notFound(res);
    const sId = student.studentId;

    const [records, subjects, quizzes, assignments, risk, engagement, recommendation, openSession, nextSession] = await Promise.all([
      AttendanceRecord.find({ studentId: sId }).populate("sessionId", "subjectName subjectId startTime mode").sort({ markedAt: -1 }).limit(500),
      student.classId ? Subject.find({ classId: student.classId }).select("name code") : Promise.resolve([]),
      QuizResult.find({ studentId: sId }).sort({ dateTaken: -1 }).limit(50),
      Assignment.find({ studentId: sId }).sort({ dueDate: -1 }).limit(50),
      computeRiskBatch([sId]),
      computeEngagementWithTrend([sId]),
      Recommendation.findOne({ studentId: sId, isActive: true }).sort({ generatedAt: -1 }),
      findOpenSessionForClass(student.classId),
      student.classId
        ? AttendanceSession.findOne({ classId: student.classId, status: "SCHEDULED", startTime: { $gt: new Date() } }).sort({ startTime: 1 })
        : Promise.resolve(null),
    ]);

    type PopulatedSession = { subjectName?: string; subjectId?: { toString(): string }; startTime?: Date; mode?: string } | null;
    const counted = records.filter((r) => r.status !== "EXCUSED");
    const attended = counted.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    const overallAttendance = pct(attended, counted.length);

    const subjectAttendance = subjects.map((subj) => {
      const recs = counted.filter((r) => (r.sessionId as unknown as PopulatedSession)?.subjectId?.toString() === subj._id.toString());
      const p = pct(recs.filter((r) => r.status === "PRESENT" || r.status === "LATE").length, recs.length);
      return {
        subject: subj.name,
        code: subj.code,
        sessions: recs.length,
        percentage: p,
        status: p === null ? "No sessions yet" : p >= 80 ? "Good" : p >= 75 ? "Average" : "Needs Attention",
      };
    });

    const r = risk.results.get(sId)!;
    const e = engagement.current.get(sId)!;
    const due = assignments.filter((a) => a.dueDate <= new Date());
    const completed = due.filter((a) => ["GRADED", "SUBMITTED", "LATE"].includes(a.status)).length;
    const openRecord = openSession ? records.find((x) => String((x.sessionId as unknown as { _id?: unknown })?._id) === String(openSession._id)) : null;

    return sendResponse({
      res,
      data: {
        student: {
          id: student.studentId,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          className: student.className,
          department: student.department,
          academicYear: student.academicYear,
          isFaceEnrolled: student.isFaceEnrolled,
          phone: student.phone,
          status: student.status,
        },
        kpis: {
          attendancePercentage: overallAttendance === null ? "—" : `${overallAttendance}%`,
          attendanceNote: counted.length ? `${attended} of ${counted.length} sessions (all time)` : "No sessions recorded yet",
          overallScore: e.overallScore === null ? "—" : `${e.overallScore} / 100`,
          academicRisk: r.level ?? "UNKNOWN",
          assignmentsCompleted: `${completed} / ${due.length}`,
        },
        activeSession: openSession
          ? {
              id: openSession._id,
              subjectName: openSession.subjectName,
              className: openSession.className,
              mode: openSession.mode,
              room: openSession.room || "—",
              startTime: openSession.startTime,
              endTime: openSession.endTime,
              alreadyMarked: Boolean(openRecord),
            }
          : null,
        nextSession: nextSession ? { subjectName: nextSession.subjectName, startTime: nextSession.startTime, mode: nextSession.mode } : null,
        subjectAttendance,
        recentAttendance: records.slice(0, 6).map((x) => ({
          id: x._id,
          subject: (x.sessionId as unknown as PopulatedSession)?.subjectName ?? "—",
          date: (x.sessionId as unknown as PopulatedSession)?.startTime ?? x.markedAt,
          status: x.status,
          verificationMethod: x.verificationMethod,
        })),
        engagement: {
          overallScore: e.overallScore,
          components: Object.fromEntries(Object.entries(e.components).map(([k, c]) => [k, c.score])),
          trend: engagement.trends.get(sId)?.trend ?? "NEW",
        },
        risk: { riskLevel: r.level ?? "UNKNOWN", reasons: r.factors.map((f) => f.message), strengths: r.strengths },
        recommendations: recommendation
          ? {
              summary: recommendation.summary,
              priority: recommendation.priority,
              source: recommendation.source,
              items: recommendation.recommendations.filter((i) => i.audience === "STUDENT").slice(0, 3),
            }
          : null,
        quizzes: quizzes.map((q) => ({ title: q.quizTitle, subject: q.subjectName, score: q.score, total: q.totalMarks, percentage: q.percentage, date: q.dateTaken })),
        assignments: assignments.map((a) => ({
          title: a.title,
          subject: a.subjectName,
          status: a.status,
          dueDate: a.dueDate,
          obtainedMarks: a.obtainedMarks,
          totalMarks: a.totalMarks,
          feedback: a.feedback,
        })),
      },
    });
  } catch (error) {
    console.error("[Student API] dashboard:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load student dashboard" });
  }
};

/**
 * @desc   Own attendance records (newest first)
 * @route  GET /api/student/attendance?limit=100
 */
export const getStudentAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return notFound(res);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const records = await AttendanceRecord.find({ studentId: student.studentId })
      .populate("sessionId", "subjectName className mode room startTime")
      .select("sessionId status verificationMethod confidence markedAt livenessVerified locationVerified verificationMetadata.distanceMeters verificationMetadata.note")
      .sort({ markedAt: -1 })
      .limit(limit);
    return sendResponse({ res, data: { records } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch attendance" });
  }
};

/**
 * @desc   Own quizzes and assignments
 * @route  GET /api/student/performance
 */
export const getStudentPerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return notFound(res);
    const [quizzes, assignments] = await Promise.all([
      QuizResult.find({ studentId: student.studentId }).sort({ dateTaken: -1 }),
      Assignment.find({ studentId: student.studentId }).sort({ dueDate: -1 }),
    ]);
    return sendResponse({ res, data: { quizzes, assignments } });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch performance" });
  }
};
