import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  Assignment,
  Class,
  LearningActivity,
  ParticipationRecord,
  QuizResult,
  Student,
  Subject,
  Teacher,
  User,
  IAttendanceSession,
} from "../models";

/**
 * Demo history: six weeks of RAW academic records (sessions, attendance, quizzes, assignments,
 * participation, learning logs) so the analytics engines have something real to analyse.
 *
 * - Everything here is clearly demo data and deterministic (seeded PRNG).
 * - Seeded attendance is marked MANUAL with a note; it never claims face/location verification.
 * - Engagement, risk and recommendations are NOT seeded — they are computed from these records.
 * - Runs once (guarded by a marker document); `npm run seed:reset` rebuilds from scratch.
 */

const MARKER_ID = "demo-history-v1";
const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 6;

// Deterministic PRNG (mulberry32) seeded from a string
const rng = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Profile {
  attendance: [number, number]; // base probability, change per week
  late: number;
  quiz: [number, number]; // mean %, change per week
  assignment: [number, number]; // completion probability, mean grade %
  participation: number; // mean rating 0-3
  learningPerWeek: number; // average logged activities per week
}

const PROFILES: Record<string, Profile> = {
  S101: { attendance: [0.95, -0.07], late: 0.1, quiz: [74, -2.5], assignment: [0.85, 76], participation: 1.9, learningPerWeek: 1.2 },
  S102: { attendance: [0.95, 0], late: 0.05, quiz: [85, 0.5], assignment: [0.95, 88], participation: 2.4, learningPerWeek: 2 },
  S103: { attendance: [0.85, -0.1], late: 0.2, quiz: [55, -3], assignment: [0.45, 55], participation: 0.8, learningPerWeek: 0.2 },
  S104: { attendance: [0.78, -0.03], late: 0.15, quiz: [64, 0], assignment: [0.7, 66], participation: 1.4, learningPerWeek: 0.5 },
  S105: { attendance: [0.82, 0], late: 0.1, quiz: [66, 0], assignment: [0.5, 62], participation: 1.2, learningPerWeek: 0 },
  S106: { attendance: [0.97, 0], late: 0.03, quiz: [88, 0], assignment: [1, 90], participation: 2.6, learningPerWeek: 3 },
  S107: { attendance: [0.9, 0], late: 0.08, quiz: [76, 0], assignment: [0.9, 80], participation: 1.8, learningPerWeek: 1 },
  S108: { attendance: [0.93, 0.01], late: 0.05, quiz: [81, 0.5], assignment: [0.95, 84], participation: 2.2, learningPerWeek: 1.5 },
  S109: { attendance: [0.78, -0.05], late: 0.2, quiz: [60, -2], assignment: [0.6, 60], participation: 1.1, learningPerWeek: 0.3 },
  S110: { attendance: [0.96, 0], late: 0.02, quiz: [90, 0], assignment: [1, 92], participation: 2.7, learningPerWeek: 2.5 },
  S111: { attendance: [0.88, 0], late: 0.1, quiz: [72, 0], assignment: [0.85, 74], participation: 1.7, learningPerWeek: 1 },
  S112: { attendance: [0.68, -0.06], late: 0.25, quiz: [50, -2], assignment: [0.4, 52], participation: 0.7, learningPerWeek: 0 },
  S113: { attendance: [0.88, 0.02], late: 0.08, quiz: [77, 1], assignment: [0.9, 79], participation: 2, learningPerWeek: 1.2 },
  S114: { attendance: [0.84, -0.02], late: 0.1, quiz: [70, -0.5], assignment: [0.8, 70], participation: 1.5, learningPerWeek: 0.8 },
  S115: { attendance: [0.91, 0], late: 0.05, quiz: [83, 0], assignment: [0.9, 85], participation: 2.1, learningPerWeek: 1.5 },
  S116: { attendance: [0.8, -0.04], late: 0.15, quiz: [62, -1.5], assignment: [0.65, 63], participation: 1.2, learningPerWeek: 0.4 },
  S117: { attendance: [0.94, 0.01], late: 0.04, quiz: [87, 0.5], assignment: [0.95, 89], participation: 2.5, learningPerWeek: 2 },
};

const EXTRA_STUDENTS = [
  { studentId: "S108", name: "Neha Joshi", email: "neha.student@attendiq.edu", rollNumber: "MCA-2025-08", classCode: "MCA-2" },
  { studentId: "S109", name: "Vikram Rao", email: "vikram.student@attendiq.edu", rollNumber: "MCA-2025-09", classCode: "MCA-2" },
  { studentId: "S110", name: "Sneha Iyer", email: "sneha.student@attendiq.edu", rollNumber: "MCA-2025-10", classCode: "MCA-2" },
  { studentId: "S111", name: "Arjun Mehta", email: "arjun.student@attendiq.edu", rollNumber: "BCA-2024-11", classCode: "BCA-4" },
  { studentId: "S112", name: "Riya Kapoor", email: "riya.student@attendiq.edu", rollNumber: "BCA-2024-12", classCode: "BCA-4" },
  { studentId: "S113", name: "Dev Malhotra", email: "dev.student@attendiq.edu", rollNumber: "BCA-2025-13", classCode: "BCA-2" },
  { studentId: "S114", name: "Isha Nair", email: "isha.student@attendiq.edu", rollNumber: "BCA-2025-14", classCode: "BCA-2" },
  { studentId: "S115", name: "Rohan Gupta", email: "rohan.student@attendiq.edu", rollNumber: "MCA-2024-15", classCode: "MCA-4" },
  { studentId: "S116", name: "Kavya Reddy", email: "kavya.student@attendiq.edu", rollNumber: "MCA-2024-16", classCode: "MCA-4" },
  { studentId: "S117", name: "Aditya Kulkarni", email: "aditya.student@attendiq.edu", rollNumber: "MCA-2024-17", classCode: "MCA-4" },
];

const EXTRA_SUBJECTS = [
  { name: "Operating Systems", code: "BCA402", classCode: "BCA-4", teacherId: "T202", semester: 4 },
  { name: "Programming in C", code: "BCA202", classCode: "BCA-2", teacherId: "T202", semester: 2 },
  { name: "Machine Learning", code: "MCA401", classCode: "MCA-4", teacherId: "T202", semester: 4 },
  { name: "Cloud Computing", code: "MCA402", classCode: "MCA-4", teacherId: "T202", semester: 4 },
];

const QUIZ_TOPICS = ["Unit 1 Quiz", "Unit 2 Quiz", "Unit 3 Quiz"];
const ASSIGNMENT_TOPICS = ["Assignment 1", "Assignment 2", "Assignment 3 (upcoming)"];
const STUDY_TITLES = ["Revised lecture notes", "Solved practice problems", "Watched tutorial video", "Group study", "Lab exercise practice"];

const SeedMeta =
  mongoose.models.SeedMeta ||
  mongoose.model("SeedMeta", new mongoose.Schema({ _id: String, status: String, appliedAt: Date }, { collection: "seedmeta" }));

export const seedDemoHistory = async (): Promise<void> => {
  // Claim the marker atomically (unique _id) so concurrent server processes never seed twice
  try {
    await SeedMeta.create({ _id: MARKER_ID, status: "RUNNING", appliedAt: new Date() });
  } catch {
    return;
  }
  try {
    await buildHistory();
    await SeedMeta.updateOne({ _id: MARKER_ID }, { $set: { status: "DONE", appliedAt: new Date() } });
  } catch (error) {
    await SeedMeta.deleteOne({ _id: MARKER_ID });
    throw error;
  }
};

const buildHistory = async () => {
  console.log("[Seed] Building 6 weeks of demo academic history (raw records only)...");

  const classes = new Map((await Class.find()).map((c) => [c.code, c]));
  const teachers = new Map((await Teacher.find()).map((t) => [t.teacherId, t]));

  // ---- Extra subjects / students / accounts (create only if missing) ----
  for (const s of EXTRA_SUBJECTS) {
    const cls = classes.get(s.classCode);
    const teacher = teachers.get(s.teacherId);
    if (!cls || !teacher || (await Subject.exists({ code: s.code }))) continue;
    await Subject.create({ name: s.name, code: s.code, classId: cls._id, teacherId: teacher._id, semester: s.semester });
    await Teacher.updateOne({ _id: teacher._id }, { $addToSet: { assignedClasses: cls._id } });
  }
  for (const s of EXTRA_STUDENTS) {
    const cls = classes.get(s.classCode);
    if (!cls) continue;
    if (!(await Student.exists({ studentId: s.studentId }))) {
      await Student.create({
        studentId: s.studentId,
        name: s.name,
        email: s.email,
        rollNumber: s.rollNumber,
        classId: cls._id,
        className: cls.name,
        academicYear: cls.academicYear,
        isFaceEnrolled: false,
        status: "ACTIVE",
      });
    }
  }
  for (const s of await Student.find({ studentId: { $in: Object.keys(PROFILES) } })) {
    if (!(await User.exists({ email: s.email }))) {
      await User.create({ name: s.name, email: s.email, password: "Student@123456", role: "STUDENT", studentId: s.studentId });
    }
  }

  // ---- Sessions: Mon / Wed / Fri for every subject over the last WEEKS weeks (excluding today) ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const subjects = await Subject.find({ teacherId: { $exists: true } });
  const teacherById = new Map([...teachers.values()].map((t) => [String(t._id), t]));
  const classById = new Map([...classes.values()].map((c) => [String(c._id), c]));
  const students = await Student.find({ studentId: { $in: Object.keys(PROFILES) }, status: "ACTIVE" });

  const sessionDocs: Record<string, unknown>[] = [];
  subjects.forEach((subject, subjectIndex) => {
    const teacher = teacherById.get(String(subject.teacherId));
    const cls = classById.get(String(subject.classId));
    if (!teacher || !cls) return;
    for (let d = WEEKS * 7; d >= 1; d--) {
      const day = new Date(today.getTime() - d * DAY);
      if (![1, 3, 5].includes(day.getDay())) continue;
      const start = new Date(day);
      start.setHours(9 + (subjectIndex % 4) * 2, 30, 0, 0);
      sessionDocs.push({
        classId: cls._id,
        className: cls.name,
        division: cls.division,
        subjectId: subject._id,
        subjectName: subject.name,
        teacherId: teacher._id,
        teacherName: teacher.name,
        mode: d % 9 === 0 ? "REMOTE" : "PHYSICAL",
        room: "Seeded schedule",
        startTime: start,
        endTime: new Date(start.getTime() + 60 * 60 * 1000),
        durationMinutes: 60,
        lateAfterMinutes: 15,
        status: "COMPLETED",
        isActive: false,
        endedAt: new Date(start.getTime() + 60 * 60 * 1000),
        endedBy: "SYSTEM",
      });
    }
  });
  const sessions = (await AttendanceSession.insertMany(sessionDocs)) as unknown as IAttendanceSession[];

  const records: Record<string, unknown>[] = [];
  const ratings: Record<string, unknown>[] = [];
  for (const session of sessions) {
    const weekIndex = WEEKS - 1 - Math.floor((today.getTime() - session.startTime.getTime()) / (7 * DAY)); // 0 = oldest
    for (const student of students) {
      if (!student.classId?.equals(session.classId)) continue;
      const p = PROFILES[student.studentId];
      const r = rng(`${student.studentId}:${session._id}`);
      const attendProb = clamp(p.attendance[0] + p.attendance[1] * weekIndex, 0.05, 0.99);
      const attended = r() < attendProb;
      const late = attended && r() < p.late;
      records.push({
        sessionId: session._id,
        studentId: student.studentId,
        student: student._id,
        status: attended ? (late ? "LATE" : "PRESENT") : "ABSENT",
        verificationMethod: attended ? "MANUAL" : "NOT_VERIFIED",
        confidence: 0,
        livenessVerified: false,
        locationVerified: false,
        verificationMetadata: { note: "Seeded demo record (not biometrically verified)" },
        markedAt: new Date(session.startTime.getTime() + (late ? 20 : 5) * 60 * 1000),
        markedBy: attended ? "TEACHER" : "SYSTEM",
      });
      if (attended && r() < 0.7) {
        ratings.push({
          sessionId: session._id,
          student: student._id,
          studentId: student.studentId,
          classId: session.classId,
          subjectId: session.subjectId,
          rating: Math.round(clamp(p.participation + (r() - 0.5) * 1.6, 0, 3)),
          ratedBy: session.teacherId,
          ratedAt: session.startTime,
        });
      }
    }
  }
  await AttendanceRecord.insertMany(records, { ordered: false }).catch(() => undefined);
  await ParticipationRecord.insertMany(ratings, { ordered: false }).catch(() => undefined);

  // ---- Quizzes (weeks 1, 3, 5) and assignments (due weeks 2, 4 + one upcoming) ----
  const quizzes: Record<string, unknown>[] = [];
  const assignments: Record<string, unknown>[] = [];
  const activities: Record<string, unknown>[] = [];
  for (const student of students) {
    const p = PROFILES[student.studentId];
    const classSubjects = subjects.filter((s) => student.classId?.equals(s.classId));
    for (const subject of classSubjects) {
      const r = rng(`${student.studentId}:${subject.code}`);
      [1, 3, 5].forEach((week, i) => {
        const score = Math.round(clamp(p.quiz[0] + p.quiz[1] * week + (r() - 0.5) * 16, 15, 100));
        quizzes.push({
          studentId: student.studentId,
          student: student._id,
          subjectId: subject._id,
          subjectName: subject.name,
          quizTitle: `${subject.name} — ${QUIZ_TOPICS[i]}`,
          score,
          totalMarks: 100,
          percentage: score,
          dateTaken: new Date(today.getTime() - (WEEKS - week) * 7 * DAY + 2 * DAY),
        });
      });
      [2, 4].forEach((week, i) => {
        const due = new Date(today.getTime() - (WEEKS - week) * 7 * DAY + 4 * DAY);
        const submitted = r() < p.assignment[0];
        const late = submitted && r() < 0.2;
        const grade = Math.round(clamp(p.assignment[1] + (r() - 0.5) * 14, 20, 100));
        assignments.push({
          studentId: student.studentId,
          student: student._id,
          subjectId: subject._id,
          subjectName: subject.name,
          title: `${subject.name} — ${ASSIGNMENT_TOPICS[i]}`,
          totalMarks: 100,
          obtainedMarks: submitted ? grade : undefined,
          dueDate: due,
          submittedAt: submitted ? new Date(due.getTime() + (late ? 2 : -1) * DAY) : undefined,
          status: submitted ? (late ? "LATE" : "GRADED") : "PENDING",
        });
      });
      assignments.push({
        studentId: student.studentId,
        student: student._id,
        subjectId: subject._id,
        subjectName: subject.name,
        title: `${subject.name} — ${ASSIGNMENT_TOPICS[2]}`,
        totalMarks: 100,
        dueDate: new Date(today.getTime() + 5 * DAY),
        status: "PENDING",
      });
    }
    // Learning activity logs
    const r = rng(`${student.studentId}:learning`);
    for (let w = 0; w < WEEKS; w++) {
      const count = Math.floor(p.learningPerWeek + r());
      for (let k = 0; k < count; k++) {
        const subject = classSubjects[Math.floor(r() * classSubjects.length)];
        activities.push({
          student: student._id,
          studentId: student.studentId,
          type: r() < 0.6 ? "STUDY_SESSION" : "PRACTICE",
          title: STUDY_TITLES[Math.floor(r() * STUDY_TITLES.length)],
          minutes: 20 + Math.floor(r() * 50),
          subjectId: subject?._id,
          subjectName: subject?.name,
          occurredAt: new Date(today.getTime() - (WEEKS - w) * 7 * DAY + Math.floor(r() * 6) * DAY + 18 * 3600 * 1000),
        });
      }
    }
  }
  await QuizResult.insertMany(quizzes);
  await Assignment.insertMany(assignments);
  if (activities.length) await LearningActivity.insertMany(activities);

  console.log(
    `[Seed] ✅ Demo history: ${sessions.length} sessions, ${records.length} attendance records, ${quizzes.length} quizzes, ${assignments.length} assignments, ${ratings.length} participation ratings, ${activities.length} learning logs`
  );
};
