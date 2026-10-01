import { Response } from "express";
import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  Class,
  LearningActivity,
  ParticipationRecord,
  Student,
  Subject,
  IStudent,
} from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedStudent, getAuthenticatedTeacher } from "../utils/actor";
import { getTeacherClassIds } from "./sessionController";
import { ENGAGEMENT_CONFIG, ENGAGEMENT_LABELS } from "../config/analytics";
import {
  computeEngagementHistory,
  computeEngagementWithTrend,
  saveEngagementSnapshots,
  EngagementResult,
} from "../services/engagementService";

const DAY = 24 * 60 * 60 * 1000;

export const engagementMethodology = () => ({
  weights: ENGAGEMENT_CONFIG.weights,
  labels: ENGAGEMENT_LABELS,
  windowDays: ENGAGEMENT_CONFIG.windowDays,
  lateCredit: ENGAGEMENT_CONFIG.lateCredit,
  learningTargetMinutes: ENGAGEMENT_CONFIG.learningTargetMinutes,
  trendDelta: ENGAGEMENT_CONFIG.trendDelta,
});

const serialize = (r: EngagementResult) => ({
  overallScore: r.overallScore,
  coverage: r.coverage,
  missingComponents: r.missingComponents,
  components: r.components,
  explanation: r.explanation,
  windowStart: r.windowStart,
  windowEnd: r.windowEnd,
});

const average = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
};

const distribution = (scores: (number | null)[]) => ({
  high: scores.filter((s) => s !== null && s >= 75).length,
  moderate: scores.filter((s) => s !== null && s >= 50 && s < 75).length,
  low: scores.filter((s) => s !== null && s < 50).length,
  insufficientData: scores.filter((s) => s === null).length,
});

const studentIdMap = (students: IStudent[]) =>
  new Map(students.map((s) => [s.studentId, s._id as mongoose.Types.ObjectId]));

// =====================================================================
// STUDENT
// =====================================================================

/**
 * @route GET /api/student/engagement
 */
export const getMyEngagement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });

    const ids = [student.studentId];
    const [{ current, trends }, history, activities] = await Promise.all([
      computeEngagementWithTrend(ids),
      computeEngagementHistory(ids),
      LearningActivity.find({ studentId: student.studentId }).sort({ occurredAt: -1 }).limit(10),
    ]);
    await saveEngagementSnapshots(current, trends, studentIdMap([student]));
    const result = current.get(student.studentId)!;

    return sendResponse({
      res,
      data: {
        ...serialize(result),
        trend: trends.get(student.studentId),
        history: history.map((p) => ({ date: p.date, score: p.scores.get(student.studentId) ?? null })),
        recentActivities: activities.map((a) => ({
          id: a._id,
          type: a.type,
          title: a.title,
          minutes: a.minutes,
          subjectName: a.subjectName,
          occurredAt: a.occurredAt,
        })),
        methodology: engagementMethodology(),
      },
    });
  } catch (error) {
    console.error("[Engagement API] student:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute engagement" });
  }
};

/**
 * @desc   Log self-study / practice time (counts towards Learning Activity, 10%)
 * @route  POST /api/student/learning-activities
 * @body   { type: "STUDY_SESSION"|"PRACTICE", title, minutes, subjectId?, occurredAt? }
 */
export const logLearningActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });

    const { type, title, minutes, subjectId, occurredAt } = req.body ?? {};
    if (type !== "STUDY_SESSION" && type !== "PRACTICE") {
      return sendResponse({ res, statusCode: 400, error: "type must be STUDY_SESSION or PRACTICE." });
    }
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
    if (cleanTitle.length < 3) return sendResponse({ res, statusCode: 400, error: "Describe the activity (at least 3 characters)." });
    const mins = Number(minutes);
    if (!Number.isInteger(mins) || mins < 5 || mins > 240) {
      return sendResponse({ res, statusCode: 400, error: "minutes must be a whole number between 5 and 240." });
    }
    const when = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 60_000 || when.getTime() < Date.now() - 7 * DAY) {
      return sendResponse({ res, statusCode: 400, error: "Activities can be logged for the last 7 days only." });
    }

    let subject = null;
    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(String(subjectId))) return sendResponse({ res, statusCode: 400, error: "Invalid subject." });
      subject = await Subject.findById(subjectId);
      if (!subject || !student.classId || !subject.classId.equals(student.classId)) {
        return sendResponse({ res, statusCode: 400, error: "Subject is not part of your class." });
      }
    }

    // Anti-inflation guard: at most 8 hours of self-reported learning per calendar day
    const dayStart = new Date(when);
    dayStart.setHours(0, 0, 0, 0);
    const sameDay = await LearningActivity.aggregate([
      { $match: { studentId: student.studentId, type: { $ne: "RECOMMENDATION_ACTION" }, occurredAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + DAY) } } },
      { $group: { _id: null, total: { $sum: "$minutes" } } },
    ]);
    if ((sameDay[0]?.total ?? 0) + mins > 480) {
      return sendResponse({ res, statusCode: 400, error: "Daily limit reached: at most 8 hours of learning can be logged per day." });
    }

    const activity = await LearningActivity.create({
      student: student._id,
      studentId: student.studentId,
      type,
      title: cleanTitle,
      minutes: mins,
      subjectId: subject?._id,
      subjectName: subject?.name,
      occurredAt: when,
    });
    return sendResponse({ res, statusCode: 201, message: "Learning activity logged.", data: activity });
  } catch (error) {
    console.error("[Engagement API] log activity:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to log learning activity" });
  }
};

/** Subjects of the signed-in student's class (for activity logging forms). */
export const getMySubjects = async (req: AuthenticatedRequest, res: Response) => {
  const student = await getAuthenticatedStudent(req);
  if (!student) return sendResponse({ res, statusCode: 404, error: "Student profile not found" });
  const subjects = student.classId ? await Subject.find({ classId: student.classId }).select("name code").sort({ name: 1 }) : [];
  return sendResponse({ res, data: { subjects: subjects.map((s) => ({ id: s._id, name: s.name, code: s.code })) } });
};

// =====================================================================
// TEACHER
// =====================================================================

/**
 * Resolve which students a teacher may view, honouring optional class/subject filters.
 * Returns null (and sends a response) when the filter is not authorized.
 */
export const resolveTeacherScope = async (req: AuthenticatedRequest, res: Response) => {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) {
    sendResponse({ res, statusCode: 403, error: "Teacher profile not found for this account." });
    return null;
  }
  const allowed = await getTeacherClassIds(teacher);
  const allowedSet = new Set(allowed.map(String));
  const classes = await Class.find({ _id: { $in: allowed } }).select("name code division").sort({ name: 1 });

  const { classId, subjectId } = req.query as Record<string, string | undefined>;
  let classIds = allowed;
  if (classId) {
    if (!mongoose.Types.ObjectId.isValid(classId) || !allowedSet.has(classId)) {
      sendResponse({ res, statusCode: 403, error: "You are not assigned to this class." });
      return null;
    }
    classIds = [new mongoose.Types.ObjectId(classId)];
  }
  const subjects = await Subject.find({ classId: { $in: allowed } }).select("name code classId teacherId").sort({ name: 1 });
  let subjectIds: mongoose.Types.ObjectId[] | undefined;
  if (subjectId) {
    const subject = subjects.find((s) => String(s._id) === subjectId);
    if (!subject || !classIds.some((c) => c.equals(subject.classId))) {
      sendResponse({ res, statusCode: 400, error: "Subject is not part of the selected class(es)." });
      return null;
    }
    subjectIds = [subject._id as mongoose.Types.ObjectId];
  }
  const students = await Student.find({ classId: { $in: classIds }, status: "ACTIVE" }).sort({ studentId: 1 });
  return {
    teacher,
    students,
    subjectIds,
    filters: {
      classes: classes.map((c) => ({ id: c._id, name: c.name, code: c.code, division: c.division })),
      subjects: subjects.map((s) => ({ id: s._id, name: s.name, code: s.code, classId: s.classId })),
    },
  };
};

/**
 * @route GET /api/teacher/engagement?classId=&subjectId=
 */
export const getClassEngagement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await resolveTeacherScope(req, res);
    if (!scope) return;
    const { students, subjectIds, filters } = scope;
    const ids = students.map((s) => s.studentId);

    const [{ current, trends }, history] = await Promise.all([
      computeEngagementWithTrend(ids, { subjectIds }),
      computeEngagementHistory(ids, { subjectIds }),
    ]);
    if (!subjectIds) await saveEngagementSnapshots(current, trends, studentIdMap(students));

    const rows = students.map((s) => {
      const r = current.get(s.studentId)!;
      return {
        studentId: s.studentId,
        name: s.name,
        rollNumber: s.rollNumber,
        className: s.className,
        overallScore: r.overallScore,
        components: Object.fromEntries(Object.entries(r.components).map(([k, c]) => [k, c.score])),
        coverage: r.coverage,
        missingComponents: r.missingComponents,
        trend: trends.get(s.studentId)?.trend ?? "NEW",
        previousScore: trends.get(s.studentId)?.previousScore ?? null,
        explanation: r.explanation,
      };
    });
    const scores = rows.map((r) => r.overallScore);
    const componentAverages = Object.fromEntries(
      Object.keys(ENGAGEMENT_CONFIG.weights).map((k) => [k, average(rows.map((r) => (r.components as Record<string, number | null>)[k]))])
    );

    return sendResponse({
      res,
      data: {
        summary: {
          studentCount: rows.length,
          averageScore: average(scores),
          distribution: distribution(scores),
          componentAverages,
          improving: rows.filter((r) => r.trend === "UP").length,
          declining: rows.filter((r) => r.trend === "DOWN").length,
        },
        history: history.map((p) => ({ date: p.date, averageScore: average([...p.scores.values()]) })),
        students: rows,
        filters,
        methodology: engagementMethodology(),
      },
    });
  } catch (error) {
    console.error("[Engagement API] class:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute class engagement" });
  }
};

/**
 * @desc   Session roster with attendance + participation ratings (for rating participation)
 * @route  GET /api/teacher/sessions/:id/participation
 */
export const getSessionParticipation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return sendResponse({ res, statusCode: 403, error: "Teacher profile not found." });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    if (!session.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You can only view your own sessions." });
    }
    const [students, records, ratings] = await Promise.all([
      Student.find({ classId: session.classId, status: "ACTIVE" }).sort({ studentId: 1 }),
      AttendanceRecord.find({ sessionId: session._id }),
      ParticipationRecord.find({ sessionId: session._id }),
    ]);
    const recordMap = new Map(records.map((r) => [r.studentId, r.status]));
    const ratingMap = new Map(ratings.map((r) => [r.studentId, r.rating]));
    return sendResponse({
      res,
      data: {
        session: { id: session._id, subjectName: session.subjectName, className: session.className, status: session.status, startTime: session.startTime },
        students: students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          attendance: recordMap.get(s.studentId) ?? "NOT_MARKED",
          rating: ratingMap.has(s.studentId) ? ratingMap.get(s.studentId) : null,
        })),
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to load participation" });
  }
};

/**
 * @desc   Rate participation (0-3) for students who attended a session
 * @route  PUT /api/teacher/sessions/:id/participation
 * @body   { ratings: [{ studentId, rating }] }
 */
export const rateParticipation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await getAuthenticatedTeacher(req);
    if (!teacher) return sendResponse({ res, statusCode: 403, error: "Teacher profile not found." });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) return sendResponse({ res, statusCode: 404, error: "Session not found" });
    if (!session.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
      return sendResponse({ res, statusCode: 403, error: "You can only rate participation for your own sessions." });
    }

    const ratings = req.body?.ratings;
    if (!Array.isArray(ratings) || ratings.length === 0 || ratings.length > 300) {
      return sendResponse({ res, statusCode: 400, error: "ratings must be a non-empty array." });
    }
    const parsed: { studentId: string; rating: 0 | 1 | 2 | 3 }[] = [];
    for (const r of ratings) {
      const rating = Number(r?.rating);
      if (typeof r?.studentId !== "string" || ![0, 1, 2, 3].includes(rating)) {
        return sendResponse({ res, statusCode: 400, error: "Each rating needs a studentId and a rating from 0 to 3." });
      }
      parsed.push({ studentId: r.studentId.toUpperCase(), rating: rating as 0 | 1 | 2 | 3 });
    }

    // Only students of this class who were present/late can be rated
    const attended = await AttendanceRecord.find({
      sessionId: session._id,
      studentId: { $in: parsed.map((p) => p.studentId) },
      status: { $in: ["PRESENT", "LATE"] },
    }).select("studentId student");
    const attendedMap = new Map(attended.map((a) => [a.studentId, a.student]));
    const rejected = parsed.filter((p) => !attendedMap.has(p.studentId)).map((p) => p.studentId);
    if (rejected.length) {
      return sendResponse({
        res,
        statusCode: 400,
        error: `Participation can only be rated for students who attended: ${rejected.join(", ")}`,
      });
    }

    await ParticipationRecord.bulkWrite(
      parsed.map((p) => ({
        updateOne: {
          filter: { sessionId: session._id, studentId: p.studentId },
          update: {
            $set: {
              student: attendedMap.get(p.studentId),
              classId: session.classId,
              subjectId: session.subjectId,
              rating: p.rating,
              ratedBy: teacher._id,
              ratedAt: session.startTime,
            },
          },
          upsert: true,
        },
      }))
    );
    return sendResponse({ res, message: `Saved participation for ${parsed.length} student(s).` });
  } catch (error) {
    console.error("[Engagement API] rate:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to save participation" });
  }
};

// =====================================================================
// ADMIN
// =====================================================================

/**
 * @route GET /api/admin/analytics/engagement?classId=
 */
export const getInstitutionEngagement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classId } = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = { status: "ACTIVE" };
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) return sendResponse({ res, statusCode: 400, error: "Invalid classId" });
      filter.classId = new mongoose.Types.ObjectId(classId);
    }
    const [students, classes] = await Promise.all([
      Student.find(filter).select("studentId name classId className"),
      Class.find({ isActive: true }).select("name code division").sort({ name: 1 }),
    ]);
    const ids = students.map((s) => s.studentId);
    const [{ current, trends }, history] = await Promise.all([
      computeEngagementWithTrend(ids),
      computeEngagementHistory(ids),
    ]);
    await saveEngagementSnapshots(current, trends, studentIdMap(students as IStudent[]));

    const byClass = classes.map((c) => {
      const members = students.filter((s) => s.classId && s.classId.equals(c._id as mongoose.Types.ObjectId));
      const scores = members.map((s) => current.get(s.studentId)?.overallScore ?? null);
      return { classId: c._id, name: c.name, code: c.code, division: c.division, studentCount: members.length, averageScore: average(scores) };
    });
    const scores = [...current.values()].map((r) => r.overallScore);
    const componentAverages = Object.fromEntries(
      Object.keys(ENGAGEMENT_CONFIG.weights).map((k) => [
        k,
        average([...current.values()].map((r) => r.components[k as keyof typeof ENGAGEMENT_CONFIG.weights].score)),
      ])
    );

    return sendResponse({
      res,
      data: {
        summary: {
          studentCount: students.length,
          averageScore: average(scores),
          distribution: distribution(scores),
          componentAverages,
          improving: [...trends.values()].filter((t) => t.trend === "UP").length,
          declining: [...trends.values()].filter((t) => t.trend === "DOWN").length,
        },
        byClass,
        history: history.map((p) => ({ date: p.date, averageScore: average([...p.scores.values()]) })),
        lowestEngaged: students
          .map((s) => ({ studentId: s.studentId, name: s.name, className: s.className, score: current.get(s.studentId)?.overallScore ?? null, trend: trends.get(s.studentId)?.trend }))
          .filter((s) => s.score !== null)
          .sort((a, b) => (a.score as number) - (b.score as number))
          .slice(0, 10),
        classes: classes.map((c) => ({ id: c._id, name: c.name, code: c.code })),
        methodology: engagementMethodology(),
      },
    });
  } catch (error) {
    console.error("[Engagement API] admin:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to compute engagement analytics" });
  }
};
