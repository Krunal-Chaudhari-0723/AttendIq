import mongoose from "mongoose";
import { AttendanceRecord, AttendanceSession, Assignment, QuizResult, Student } from "../models";

/**
 * Attendance & performance reports computed from stored records.
 * Callers pass an already-authorized scope (which sessions / students may be included).
 * Reports never contain biometric data or coordinates.
 */

export interface ReportFilters {
  from: Date;
  to: Date;
  classIds?: mongoose.Types.ObjectId[];
  subjectIds?: mongoose.Types.ObjectId[];
  teacherIds?: mongoose.Types.ObjectId[];
  studentIds?: string[];
}

const DAY = 24 * 60 * 60 * 1000;
const rate = (attended: number, counted: number) => (counted > 0 ? Math.round((attended / counted) * 100) : null);

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive), defaulting to the last 30 days. Max range 1 year. */
export const parseDateRange = (query: Record<string, unknown>): { from: Date; to: Date } | { error: string } => {
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00.000`) : new Date(to.getTime() - 30 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: "from/to must be dates in YYYY-MM-DD format." };
  if (from > to) return { error: "from must be before to." };
  if (to.getTime() - from.getTime() > 366 * DAY) return { error: "Date range cannot exceed one year." };
  return { from, to };
};

interface Tally {
  present: number;
  late: number;
  absent: number;
  excused: number;
}
const empty = (): Tally => ({ present: 0, late: 0, absent: 0, excused: 0 });
const add = (t: Tally, status: string) => {
  if (status === "PRESENT") t.present++;
  else if (status === "LATE") t.late++;
  else if (status === "ABSENT") t.absent++;
  else if (status === "EXCUSED") t.excused++;
};
const summarize = (t: Tally) => ({
  ...t,
  counted: t.present + t.late + t.absent,
  attendanceRate: rate(t.present + t.late, t.present + t.late + t.absent),
});

export const buildAttendanceReport = async (f: ReportFilters) => {
  const sessionQuery: Record<string, unknown> = {
    startTime: { $gte: f.from, $lte: f.to },
    status: { $in: ["ACTIVE", "COMPLETED"] },
  };
  if (f.classIds) sessionQuery.classId = { $in: f.classIds };
  if (f.subjectIds) sessionQuery.subjectId = { $in: f.subjectIds };
  if (f.teacherIds) sessionQuery.teacherId = { $in: f.teacherIds };

  const sessions = await AttendanceSession.find(sessionQuery).select("classId className subjectId subjectName teacherId teacherName startTime mode");
  const sessionMap = new Map(sessions.map((s) => [String(s._id), s]));
  const recordQuery: Record<string, unknown> = { sessionId: { $in: sessions.map((s) => s._id) } };
  if (f.studentIds) recordQuery.studentId = { $in: f.studentIds };
  const records = await AttendanceRecord.find(recordQuery).select("sessionId studentId status verificationMethod");

  const total = empty();
  const byDay = new Map<string, Tally>();
  const byClass = new Map<string, { name: string; t: Tally; sessions: Set<string> }>();
  const bySubject = new Map<string, { name: string; className: string; t: Tally; sessions: Set<string> }>();
  const byTeacher = new Map<string, { name: string; t: Tally; sessions: Set<string> }>();
  const byStudent = new Map<string, Tally>();
  const methods: Record<string, number> = {};

  for (const r of records) {
    const s = sessionMap.get(String(r.sessionId));
    if (!s) continue;
    add(total, r.status);
    const day = s.startTime.toISOString().slice(0, 10);
    add(byDay.get(day) || byDay.set(day, empty()).get(day)!, r.status);
    const c = byClass.get(String(s.classId)) || byClass.set(String(s.classId), { name: s.className, t: empty(), sessions: new Set() }).get(String(s.classId))!;
    add(c.t, r.status);
    c.sessions.add(String(s._id));
    const sub = bySubject.get(String(s.subjectId)) || bySubject.set(String(s.subjectId), { name: s.subjectName, className: s.className, t: empty(), sessions: new Set() }).get(String(s.subjectId))!;
    add(sub.t, r.status);
    sub.sessions.add(String(s._id));
    const te = byTeacher.get(String(s.teacherId)) || byTeacher.set(String(s.teacherId), { name: s.teacherName, t: empty(), sessions: new Set() }).get(String(s.teacherId))!;
    add(te.t, r.status);
    te.sessions.add(String(s._id));
    add(byStudent.get(r.studentId) || byStudent.set(r.studentId, empty()).get(r.studentId)!, r.status);
    methods[r.verificationMethod] = (methods[r.verificationMethod] || 0) + 1;
  }

  const students = await Student.find({ studentId: { $in: [...byStudent.keys()] } }).select("studentId name rollNumber className");
  const studentInfo = new Map(students.map((s) => [s.studentId, s]));

  return {
    range: { from: f.from, to: f.to },
    summary: { sessions: sessions.length, students: byStudent.size, ...summarize(total) },
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, ...summarize(t) })),
    byClass: [...byClass.entries()].map(([id, c]) => ({ classId: id, name: c.name, sessions: c.sessions.size, ...summarize(c.t) })).sort((a, b) => a.name.localeCompare(b.name)),
    bySubject: [...bySubject.entries()].map(([id, s]) => ({ subjectId: id, name: s.name, className: s.className, sessions: s.sessions.size, ...summarize(s.t) })).sort((a, b) => a.name.localeCompare(b.name)),
    byTeacher: [...byTeacher.entries()].map(([id, t]) => ({ teacherId: id, name: t.name, sessions: t.sessions.size, ...summarize(t.t) })).sort((a, b) => a.name.localeCompare(b.name)),
    byStudent: [...byStudent.entries()]
      .map(([studentId, t]) => ({
        studentId,
        name: studentInfo.get(studentId)?.name ?? studentId,
        rollNumber: studentInfo.get(studentId)?.rollNumber ?? "",
        className: studentInfo.get(studentId)?.className ?? "",
        ...summarize(t),
      }))
      .sort((a, b) => (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101)),
    verificationMethods: methods,
  };
};

export const buildPerformanceReport = async (f: { from: Date; to: Date; studentIds: string[]; subjectIds?: mongoose.Types.ObjectId[] }) => {
  const subjectFilter = f.subjectIds ? { subjectId: { $in: f.subjectIds } } : {};
  const [quizzes, assignments, students] = await Promise.all([
    QuizResult.find({ studentId: { $in: f.studentIds }, dateTaken: { $gte: f.from, $lte: f.to }, ...subjectFilter }).select("studentId subjectName percentage"),
    Assignment.find({ studentId: { $in: f.studentIds }, dueDate: { $gte: f.from, $lte: f.to }, ...subjectFilter }).select("studentId subjectName status obtainedMarks totalMarks"),
    Student.find({ studentId: { $in: f.studentIds } }).select("studentId name className"),
  ]);
  type Acc = { quiz: number[]; due: number; done: number; grades: number[] };
  const mk = (): Acc => ({ quiz: [], due: 0, done: 0, grades: [] });
  const byStudent = new Map<string, Acc>();
  const bySubject = new Map<string, Acc>();
  for (const q of quizzes) {
    (byStudent.get(q.studentId) || byStudent.set(q.studentId, mk()).get(q.studentId)!).quiz.push(q.percentage);
    (bySubject.get(q.subjectName) || bySubject.set(q.subjectName, mk()).get(q.subjectName)!).quiz.push(q.percentage);
  }
  for (const a of assignments) {
    for (const acc of [byStudent.get(a.studentId) || byStudent.set(a.studentId, mk()).get(a.studentId)!, bySubject.get(a.subjectName) || bySubject.set(a.subjectName, mk()).get(a.subjectName)!]) {
      acc.due++;
      if (["SUBMITTED", "GRADED", "LATE"].includes(a.status)) acc.done++;
      if (typeof a.obtainedMarks === "number" && a.totalMarks > 0) acc.grades.push((a.obtainedMarks / a.totalMarks) * 100);
    }
  }
  const avg = (v: number[]) => (v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null);
  const row = (acc: Acc) => ({
    quizCount: acc.quiz.length,
    quizAverage: avg(acc.quiz),
    assignmentsDue: acc.due,
    assignmentsSubmitted: acc.done,
    completionRate: rate(acc.done, acc.due),
    gradeAverage: avg(acc.grades),
  });
  const info = new Map(students.map((s) => [s.studentId, s]));
  return {
    bySubject: [...bySubject.entries()].map(([name, acc]) => ({ subject: name, ...row(acc) })).sort((a, b) => a.subject.localeCompare(b.subject)),
    byStudent: f.studentIds
      .map((id) => ({ studentId: id, name: info.get(id)?.name ?? id, className: info.get(id)?.className ?? "", ...row(byStudent.get(id) || mk()) }))
      .sort((a, b) => (a.quizAverage ?? 101) - (b.quizAverage ?? 101)),
  };
};

/** CSV with proper quoting (no formulas: cells starting with = + - @ are prefixed to prevent CSV injection). */
export const toCsv = (rows: Record<string, unknown>[], columns: { key: string; label: string }[]) => {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(","))].join("\n");
};

export const ATTENDANCE_CSV_COLUMNS = [
  { key: "studentId", label: "Student ID" },
  { key: "name", label: "Name" },
  { key: "rollNumber", label: "Roll Number" },
  { key: "className", label: "Class" },
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "absent", label: "Absent" },
  { key: "excused", label: "Excused" },
  { key: "attendanceRate", label: "Attendance %" },
];
