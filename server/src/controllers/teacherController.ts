import { Response } from "express";
import mongoose from "mongoose";
import {
  Class,
  Subject,
  Student,
  AttendanceSession,
  AttendanceRecord,
  QuizResult,
  Assignment,
  ITeacher,
} from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getAuthenticatedTeacher } from "../utils/actor";
import { getTeacherClassIds } from "./sessionController";
import { refreshSessionStatuses } from "../services/sessionService";
import { computeRiskBatch } from "../services/riskService";

const requireTeacher = async (req: AuthenticatedRequest, res: Response): Promise<ITeacher | null> => {
  const teacher = await getAuthenticatedTeacher(req);
  if (!teacher) {
    sendResponse({ res, statusCode: 403, error: "Teacher profile not found for this account." });
    return null;
  }
  return teacher;
};

const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

/** Present/late/absent counts per session in one aggregation. */
const countsBySession = async (sessionIds: mongoose.Types.ObjectId[]) => {
  const rows = await AttendanceRecord.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: { s: "$sessionId", st: "$status" }, n: { $sum: 1 } } },
  ]);
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = String(r._id.s);
    const entry = map.get(key) || {};
    entry[r._id.st] = r.n;
    map.set(key, entry);
  }
  return map;
};

/**
 * @desc Teacher dashboard built entirely from stored data
 * @route GET /api/teacher/dashboard
 */
export const getTeacherDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    await refreshSessionStatuses({ teacherId: teacher._id });

    const classIds = await getTeacherClassIds(teacher);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [classes, subjects, students, todaySessions, activeSessions] = await Promise.all([
      Class.find({ _id: { $in: classIds }, isActive: true }).sort({ name: 1 }),
      Subject.find({ teacherId: teacher._id }).sort({ name: 1 }),
      Student.find({ classId: { $in: classIds }, status: "ACTIVE" }).select("studentId name classId"),
      AttendanceSession.find({ teacherId: teacher._id, startTime: { $gte: dayStart, $lt: dayEnd } }).sort({ startTime: 1 }),
      AttendanceSession.find({ teacherId: teacher._id, status: "ACTIVE" }).sort({ startTime: -1 }),
    ]);

    const rosterSize = new Map<string, number>();
    for (const s of students) rosterSize.set(String(s.classId), (rosterSize.get(String(s.classId)) || 0) + 1);
    const sessionIds = [...new Map([...todaySessions, ...activeSessions].map((s) => [String(s._id), s._id as mongoose.Types.ObjectId])).values()];
    const counts = await countsBySession(sessionIds);

    // Today's attendance: attended / marked records across today's sessions
    let attended = 0;
    let marked = 0;
    for (const s of todaySessions) {
      const c = counts.get(String(s._id)) || {};
      attended += (c.PRESENT || 0) + (c.LATE || 0);
      marked += (c.PRESENT || 0) + (c.LATE || 0) + (c.ABSENT || 0);
    }

    const { results: risk, engagement } = await computeRiskBatch(students.map((s) => s.studentId));
    const scores = [...engagement.values()].map((e) => e.overallScore).filter((x): x is number => x !== null);
    const atRisk = [...risk.values()].filter((r) => r.level === "HIGH" || r.level === "MEDIUM").length;
    const highRisk = students
      .filter((s) => risk.get(s.studentId)?.level === "HIGH")
      .map((s) => ({ studentId: s.studentId, name: s.name, reason: risk.get(s.studentId)?.factors[0]?.message ?? "" }))
      .slice(0, 5);

    const sessionRow = (s: InstanceType<typeof AttendanceSession>) => {
      const c = counts.get(String(s._id)) || {};
      const total = rosterSize.get(String(s.classId)) || 0;
      return {
        id: s._id,
        name: s.subjectName,
        code: `${s.className}${s.division ? ` (${s.division})` : ""}`,
        time: `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`,
        status: s.status === "ACTIVE" ? "Active Session" : s.status === "SCHEDULED" ? "Scheduled" : s.status === "CANCELLED" ? "Cancelled" : "Completed",
        count: `${(c.PRESENT || 0) + (c.LATE || 0)} / ${total} present`,
        mode: s.mode,
        room: s.room || "—",
      };
    };

    return sendResponse({
      res,
      data: {
        teacher: { id: teacher.teacherId, name: teacher.name, email: teacher.email, department: teacher.department, designation: teacher.designation },
        kpis: {
          activeClasses: classes.length,
          todayAttendance: marked > 0 ? `${pct(attended, marked)}%` : "—",
          todayAttendanceNote: marked > 0 ? `${attended} of ${marked} marked records today` : "No attendance recorded today",
          averageEngagement: scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)} / 100` : "—",
          atRiskStudents: atRisk,
          studentCount: students.length,
        },
        activeSession: activeSessions[0]
          ? {
              id: activeSessions[0]._id,
              subjectName: activeSessions[0].subjectName,
              className: activeSessions[0].className,
              mode: activeSessions[0].mode,
              room: activeSessions[0].room || "—",
              startTime: activeSessions[0].startTime,
              endTime: activeSessions[0].endTime,
            }
          : null,
        activeSessionCount: activeSessions.length,
        schedule: todaySessions.map(sessionRow),
        highRisk,
        assignedClasses: classes.map((c) => ({ id: c._id, name: c.name, code: c.code, division: c.division, studentCount: rosterSize.get(String(c._id)) || 0 })),
        taughtSubjects: subjects.map((s) => ({ id: s._id, name: s.name, code: s.code, credits: s.credits, classId: s.classId })),
      },
    });
  } catch (error) {
    console.error("[Teacher API] dashboard:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to load teacher dashboard" });
  }
};

/**
 * @route GET /api/teacher/classes
 */
export const getTeacherClasses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    const classIds = await getTeacherClassIds(teacher);
    const [classes, subjects, counts] = await Promise.all([
      Class.find({ _id: { $in: classIds } }).populate("classTeacher", "name teacherId").sort({ name: 1 }),
      Subject.find({ classId: { $in: classIds } }).populate("teacherId", "name").sort({ name: 1 }),
      Student.aggregate([{ $match: { classId: { $in: classIds }, status: "ACTIVE" } }, { $group: { _id: "$classId", n: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    return sendResponse({
      res,
      data: {
        classes: classes.map((c) => ({
          ...c.toObject(),
          studentCount: countMap.get(String(c._id)) || 0,
          subjects: subjects
            .filter((s) => s.classId.equals(c._id as mongoose.Types.ObjectId))
            .map((s) => ({ id: s._id, name: s.name, code: s.code, teacher: (s.teacherId as unknown as { name?: string })?.name ?? null, isMine: String((s.teacherId as unknown as { _id?: unknown })?._id) === String(teacher._id) })),
        })),
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch teacher classes" });
  }
};

/**
 * @desc Students in the teacher's classes with computed engagement and risk (no placeholders)
 * @route GET /api/teacher/students?classId=
 */
export const getTeacherStudents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    const allowed = await getTeacherClassIds(teacher);
    const { classId } = req.query as Record<string, string | undefined>;
    let classIds = allowed;
    if (classId) {
      if (!allowed.some((c) => String(c) === classId)) return sendResponse({ res, statusCode: 403, error: "You are not assigned to this class." });
      classIds = [new mongoose.Types.ObjectId(classId)];
    }
    const students = await Student.find({ classId: { $in: classIds }, status: "ACTIVE" }).sort({ studentId: 1 });
    const { results, engagement } = await computeRiskBatch(students.map((s) => s.studentId));

    const enriched = students.map((s) => {
      const r = results.get(s.studentId);
      const e = engagement.get(s.studentId);
      return {
        _id: s._id,
        studentId: s.studentId,
        name: s.name,
        email: s.email,
        rollNumber: s.rollNumber,
        className: s.className,
        isFaceEnrolled: s.isFaceEnrolled,
        riskLevel: r?.level ?? "UNKNOWN",
        riskReason: r?.factors[0]?.message ?? (r?.level === "LOW" ? "No risk rules triggered" : "Not enough data"),
        attendanceRate: r?.signals.attendanceRate ?? null,
        engagementScore: e?.overallScore ?? null,
      };
    });
    return sendResponse({ res, data: { students: enriched } });
  } catch (error) {
    console.error("[Teacher API] students:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch teacher students" });
  }
};

/**
 * @desc Session history with per-session attendance counts
 * @route GET /api/teacher/attendance?limit=30
 */
export const getTeacherAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    await refreshSessionStatuses({ teacherId: teacher._id });
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 200);
    const sessions = await AttendanceSession.find({ teacherId: teacher._id }).sort({ startTime: -1 }).limit(limit);
    const counts = await countsBySession(sessions.map((s) => s._id as mongoose.Types.ObjectId));
    return sendResponse({
      res,
      data: {
        sessions: sessions.map((s) => {
          const c = counts.get(String(s._id)) || {};
          const present = c.PRESENT || 0;
          const late = c.LATE || 0;
          const absent = c.ABSENT || 0;
          const excused = c.EXCUSED || 0;
          return {
            id: s._id,
            subjectName: s.subjectName,
            className: s.className,
            division: s.division,
            mode: s.mode,
            status: s.status,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
            present,
            late,
            absent,
            excused,
            attendanceRate: pct(present + late, present + late + absent),
          };
        }),
      },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch teacher attendance" });
  }
};

/** Teacher may grade only students enrolled in the class of a subject they teach. */
const authorizeGrading = async (teacher: ITeacher, studentId: unknown, subjectId: unknown) => {
  if (typeof studentId !== "string" || !studentId.trim()) return { error: "studentId is required." };
  if (!mongoose.Types.ObjectId.isValid(String(subjectId))) return { error: "A valid subjectId is required." };
  const subject = await Subject.findById(subjectId);
  if (!subject) return { error: "Subject not found.", status: 404 };
  if (!subject.teacherId || !subject.teacherId.equals(teacher._id as mongoose.Types.ObjectId)) {
    return { error: "You can only record grades for subjects you teach.", status: 403 };
  }
  const student = await Student.findOne({ studentId: studentId.trim().toUpperCase() });
  if (!student) return { error: "Student not found.", status: 404 };
  if (!student.classId || !student.classId.equals(subject.classId)) {
    return { error: `${student.name} is not enrolled in the class for ${subject.name}.`, status: 403 };
  }
  return { student, subject };
};

/**
 * @route POST /api/teacher/quiz-results  { studentId, subjectId, quizTitle, score, totalMarks }
 */
export const recordQuizResult = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    const { studentId, subjectId, quizTitle, score, totalMarks } = req.body ?? {};
    const auth = await authorizeGrading(teacher, studentId, subjectId);
    if ("error" in auth) return sendResponse({ res, statusCode: auth.status ?? 400, error: auth.error });
    const title = typeof quizTitle === "string" ? quizTitle.trim().slice(0, 120) : "";
    if (title.length < 2) return sendResponse({ res, statusCode: 400, error: "quizTitle is required." });
    const max = totalMarks === undefined ? 100 : Number(totalMarks);
    const got = Number(score);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) return sendResponse({ res, statusCode: 400, error: "totalMarks must be between 1 and 1000." });
    if (!Number.isFinite(got) || got < 0 || got > max) return sendResponse({ res, statusCode: 400, error: `score must be between 0 and ${max}.` });

    const quiz = await QuizResult.findOneAndUpdate(
      { studentId: auth.student.studentId, subjectId: auth.subject._id, quizTitle: title },
      {
        student: auth.student._id,
        subjectName: auth.subject.name,
        score: got,
        totalMarks: max,
        percentage: Math.round((got / max) * 100),
        dateTaken: new Date(),
      },
      { upsert: true, new: true }
    );
    return sendResponse({ res, statusCode: 201, message: "Quiz result recorded successfully", data: quiz });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to record quiz result" });
  }
};

/**
 * @route POST /api/teacher/assignments  { studentId, subjectId, title, totalMarks, obtainedMarks?, dueDate?, status?, feedback? }
 */
export const recordAssignment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    const { studentId, subjectId, title, totalMarks, obtainedMarks, dueDate, status, feedback } = req.body ?? {};
    const auth = await authorizeGrading(teacher, studentId, subjectId);
    if ("error" in auth) return sendResponse({ res, statusCode: auth.status ?? 400, error: auth.error });
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
    if (cleanTitle.length < 2) return sendResponse({ res, statusCode: 400, error: "title is required." });
    const max = totalMarks === undefined ? 100 : Number(totalMarks);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) return sendResponse({ res, statusCode: 400, error: "totalMarks must be between 1 and 1000." });
    let marks: number | undefined;
    if (obtainedMarks !== undefined && obtainedMarks !== null && obtainedMarks !== "") {
      marks = Number(obtainedMarks);
      if (!Number.isFinite(marks) || marks < 0 || marks > max) return sendResponse({ res, statusCode: 400, error: `obtainedMarks must be between 0 and ${max}.` });
    }
    const finalStatus = status ?? (marks !== undefined ? "GRADED" : "PENDING");
    if (!["SUBMITTED", "PENDING", "LATE", "GRADED"].includes(finalStatus)) {
      return sendResponse({ res, statusCode: 400, error: "status must be SUBMITTED, PENDING, LATE or GRADED." });
    }
    const due = dueDate ? new Date(dueDate) : new Date();
    if (Number.isNaN(due.getTime())) return sendResponse({ res, statusCode: 400, error: "dueDate is not a valid date." });

    const assignment = await Assignment.findOneAndUpdate(
      { studentId: auth.student.studentId, subjectId: auth.subject._id, title: cleanTitle },
      {
        student: auth.student._id,
        subjectName: auth.subject.name,
        totalMarks: max,
        obtainedMarks: marks,
        dueDate: due,
        status: finalStatus,
        submittedAt: finalStatus === "PENDING" ? undefined : new Date(),
        feedback: typeof feedback === "string" ? feedback.trim().slice(0, 500) : undefined,
      },
      { upsert: true, new: true }
    );
    return sendResponse({ res, statusCode: 201, message: "Assignment recorded successfully", data: assignment });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, error: "Failed to record assignment" });
  }
};
