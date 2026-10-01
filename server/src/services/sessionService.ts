import mongoose from "mongoose";
import { AttendanceSession, AttendanceRecord, Student, IAttendanceSession } from "../models";
import { notifyAbsent, notifyHighRisk, notifyLowAttendance } from "./notificationService";
import { computeRiskBatch } from "./riskService";
import { RISK_CONFIG } from "../config/analytics";

/** After a session closes: tell absentees, and warn students whose attendance or risk crossed a threshold. */
const notifyAfterSession = async (session: IAttendanceSession, absentIds: string[]) => {
  try {
    // Only for real sessions that just ended, not historical back-fills
    if (session.endTime.getTime() < Date.now() - 24 * 60 * 60 * 1000) return;
    for (const id of absentIds) await notifyAbsent(id, session.subjectName, String(session._id));
    const students = await Student.find({ classId: session.classId, status: "ACTIVE" });
    const { results } = await computeRiskBatch(students.map((s) => s.studentId));
    for (const s of students) {
      const r = results.get(s.studentId);
      if (!r) continue;
      if (r.signals.attendanceRate !== null && r.signals.attendanceRate < RISK_CONFIG.attendance.requiredPercent) {
        await notifyLowAttendance(s.studentId, r.signals.attendanceRate);
      }
      if (r.level === "HIGH") await notifyHighRisk(s, r.factors[0]?.message ?? "");
    }
  } catch (error) {
    console.warn("[Notifications] post-session notifications failed:", (error as Error).message);
  }
};

/**
 * Attendance session lifecycle:
 *   SCHEDULED --(start time reached)--> ACTIVE --(end time reached / teacher ends)--> COMPLETED
 *
 * Statuses are advanced lazily whenever sessions are read, so no background scheduler is needed.
 */

/** Mark every class student without a record as ABSENT, then close the session. */
export const finalizeSession = async (session: IAttendanceSession, endedBy: "TEACHER" | "SYSTEM") => {
  const roster = await Student.find({ classId: session.classId, status: "ACTIVE" }).select("_id studentId");
  const marked = new Set(
    (await AttendanceRecord.find({ sessionId: session._id }).select("studentId")).map((r) => r.studentId)
  );

  const absentees = roster.filter((s) => !marked.has(s.studentId));
  if (absentees.length > 0) {
    await AttendanceRecord.bulkWrite(
      absentees.map((s) => ({
        updateOne: {
          // upsert keeps this idempotent and safe against a concurrent successful verification
          filter: { sessionId: session._id, studentId: s.studentId },
          update: {
            $setOnInsert: {
              sessionId: session._id,
              studentId: s.studentId,
              student: s._id,
              status: "ABSENT",
              verificationMethod: "NOT_VERIFIED",
              confidence: 0,
              livenessVerified: false,
              locationVerified: false,
              markedAt: session.endTime < new Date() ? session.endTime : new Date(),
              markedBy: "SYSTEM",
            },
          },
          upsert: true,
        },
      }))
    );
  }

  void notifyAfterSession(session, absentees.map((s) => s.studentId));

  const now = new Date();
  session.status = "COMPLETED";
  session.isActive = false;
  session.endedAt = now;
  session.endedBy = endedBy;
  if (session.endTime > now) session.endTime = now;
  await session.save();
  return { absentCount: absentees.length };
};

/** Advance SCHEDULED -> ACTIVE and ACTIVE -> COMPLETED based on the clock. */
export const refreshSessionStatuses = async (filter: Record<string, unknown> = {}) => {
  const now = new Date();
  await AttendanceSession.updateMany(
    { ...filter, status: "SCHEDULED", startTime: { $lte: now }, endTime: { $gt: now } },
    { $set: { status: "ACTIVE", isActive: true } }
  );
  const expired = await AttendanceSession.find({
    ...filter,
    status: { $in: ["ACTIVE", "SCHEDULED"] },
    endTime: { $lte: now },
  });
  for (const session of expired) {
    await finalizeSession(session, "SYSTEM");
  }
};

export const isSessionOpen = (session: IAttendanceSession, now = new Date()) =>
  session.status === "ACTIVE" && session.startTime <= now && session.endTime > now;

/** The currently open session for a student's class, if any. */
export const findOpenSessionForClass = async (classId: mongoose.Types.ObjectId | undefined) => {
  if (!classId) return null;
  await refreshSessionStatuses({ classId });
  return AttendanceSession.findOne({ classId, status: "ACTIVE" }).sort({ startTime: -1 });
};
