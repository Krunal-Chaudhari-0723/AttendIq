import { Assignment, Class, Notification, NotificationType, Student, Subject, Teacher, IStudent } from "../models";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { RISK_CONFIG } from "../config/analytics";

/**
 * Event-driven notifications. Every helper is fire-and-forget safe (never throws into the caller)
 * and de-duplicated with a stable key so repeated events don't spam users.
 */

interface NotifyInput {
  recipientRole: "ADMIN" | "TEACHER" | "STUDENT" | "ALL";
  recipientId?: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

/** ISO year-week, used to allow at most one similar warning per week. */
export const weekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
};

export const notify = async (input: NotifyInput) => {
  try {
    await Notification.create({ ...input, metadata: { ...input.metadata, generated: true } });
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000) console.warn("[Notifications] failed:", (error as Error).message);
  }
};

/** Query filter for notifications visible to the signed-in user. */
export const visibilityFilter = async (req: AuthenticatedRequest) => {
  const role = req.user!.role;
  if (role === "STUDENT") {
    const student = req.user!.studentId ? await Student.findOne({ studentId: req.user!.studentId }).select("studentId classId") : null;
    const ids = [student?.studentId, student?.classId ? `CLASS:${student.classId}` : undefined].filter(Boolean) as string[];
    return {
      recipientRole: { $in: ["STUDENT", "ALL"] },
      $or: [{ recipientId: { $exists: false } }, { recipientId: null }, { recipientId: { $in: ids } }],
    };
  }
  if (role === "TEACHER") {
    return {
      recipientRole: { $in: ["TEACHER", "ALL"] },
      $or: [{ recipientId: { $exists: false } }, { recipientId: null }, { recipientId: req.user!.teacherId ?? "__none__" }],
    };
  }
  return {
    recipientRole: { $in: ["ADMIN", "ALL"] },
    $or: [{ recipientId: { $exists: false } }, { recipientId: null }],
  };
};

// ---------------------------------------------------------------------------
// Domain events
// ---------------------------------------------------------------------------

export const notifyAttendanceMarked = (student: IStudent, subjectName: string, status: string, sessionId: string) =>
  notify({
    recipientRole: "STUDENT",
    recipientId: student.studentId,
    title: `Attendance recorded: ${status}`,
    message: `You were marked ${status} for ${subjectName}.`,
    type: "ATTENDANCE",
    link: "/student/attendance",
    dedupeKey: `ATT:${sessionId}:${student.studentId}`,
  });

export const notifyAbsent = (studentId: string, subjectName: string, sessionId: string) =>
  notify({
    recipientRole: "STUDENT",
    recipientId: studentId,
    title: `Marked absent: ${subjectName}`,
    message: `No verified attendance was recorded for ${subjectName}. If this is wrong, contact your teacher.`,
    type: "ATTENDANCE",
    link: "/student/attendance",
    dedupeKey: `ABS:${sessionId}:${studentId}`,
  });

export const notifyLowAttendance = (studentId: string, rate: number) =>
  notify({
    recipientRole: "STUDENT",
    recipientId: studentId,
    title: "Attendance below requirement",
    message: `Your attendance over the last 30 days is ${rate}%, below the ${RISK_CONFIG.attendance.requiredPercent}% requirement.`,
    type: "ATTENDANCE",
    link: "/student/recommendations",
    dedupeKey: `LOWATT:${studentId}:${weekKey()}`,
  });

/** Teacher + student alert when a student newly reaches HIGH risk (once per week). */
export const notifyHighRisk = async (student: IStudent, topReason: string) => {
  // Everyone who teaches this class: assigned teachers, the class teacher and subject teachers
  const ids = new Set<string>();
  if (student.classId) {
    const [assigned, cls, subjects] = await Promise.all([
      Teacher.find({ assignedClasses: student.classId }).select("teacherId"),
      Class.findById(student.classId).select("classTeacher"),
      Subject.find({ classId: student.classId, teacherId: { $exists: true } }).select("teacherId"),
    ]);
    const refs = [cls?.classTeacher, ...subjects.map((x) => x.teacherId)].filter(Boolean);
    const linked = refs.length ? await Teacher.find({ _id: { $in: refs } }).select("teacherId") : [];
    for (const t of [...assigned, ...linked]) ids.add(t.teacherId);
  }
  for (const teacherId of ids) {
    await notify({
      recipientRole: "TEACHER",
      recipientId: teacherId,
      title: `High risk: ${student.name}`,
      message: `${student.name} (${student.studentId}, ${student.className}) is now flagged HIGH risk. ${topReason}`,
      type: "RISK_ALERT",
      link: `/teacher/recommendations?studentId=${student.studentId}`,
      dedupeKey: `RISK:${teacherId}:${student.studentId}:${weekKey()}`,
    });
  }
  await notify({
    recipientRole: "STUDENT",
    recipientId: student.studentId,
    title: "Your academic standing needs attention",
    message: `${topReason} Check your recommendations for next steps.`,
    type: "RISK_ALERT",
    link: "/student/recommendations",
    dedupeKey: `RISK:${student.studentId}:${weekKey()}`,
  });
};

export const notifyRecommendation = (studentId: string, source: "AI" | "RULE_BASED", recommendationId: string) =>
  notify({
    recipientRole: "STUDENT",
    recipientId: studentId,
    title: "New recommendations from your teacher",
    message: `Your teacher shared ${source === "AI" ? "AI-generated" : "rule-based"} recommendations based on your recent records.`,
    type: "RECOMMENDATION",
    link: "/student/recommendations",
    dedupeKey: `REC:${recommendationId}`,
  });

/** Lazily create due-soon reminders (next 48 h) for a student's pending assignments. */
export const ensureAssignmentReminders = async (studentId: string) => {
  const now = Date.now();
  const due = await Assignment.find({
    studentId,
    status: "PENDING",
    dueDate: { $gte: new Date(now), $lte: new Date(now + 48 * 3600 * 1000) },
  }).select("title subjectName dueDate");
  for (const a of due) {
    await notify({
      recipientRole: "STUDENT",
      recipientId: studentId,
      title: `Assignment due soon: ${a.subjectName}`,
      message: `"${a.title}" is due ${a.dueDate.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
      type: "REMINDER",
      link: "/student/performance",
      dedupeKey: `DUE:${a._id}`,
    });
  }
};
