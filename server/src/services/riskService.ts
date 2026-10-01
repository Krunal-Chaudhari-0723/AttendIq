import mongoose from "mongoose";
import { RiskAssessment, IStudent, IRiskFactor, RiskLevel } from "../models";
import { RISK_CONFIG } from "../config/analytics";
import { computeEngagementBatch, computeEngagementWithTrend, EngagementResult, Trend } from "./engagementService";

/**
 * Explainable academic RISK INDICATOR — a transparent rule set over recorded signals.
 * It flags students who may need support; it is not a prediction of outcomes.
 * Every rule that fires contributes points AND a human-readable reason.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface RiskResult {
  studentId: string;
  level: RiskLevel | null; // null = not enough data to assess
  points: number;
  factors: IRiskFactor[];
  strengths: string[];
  signals: {
    attendanceRate: number | null;
    recentAttendanceRate: number | null;
    previousAttendanceRate: number | null;
    quizAverage: number | null;
    assignmentCompletionRate: number | null;
    engagementScore: number | null;
    engagementTrend: Trend;
    engagementPrevious: number | null;
    participation: number | null;
  };
}

const rate = (r: EngagementResult | undefined) =>
  r && r.signals.sessionsCounted > 0 ? Math.round((r.signals.sessionsAttended / r.signals.sessionsCounted) * 100) : null;

const levelFor = (points: number): RiskLevel =>
  points >= RISK_CONFIG.levels.high.minPoints ? "HIGH" : points >= RISK_CONFIG.levels.medium.minPoints ? "MEDIUM" : "LOW";

export const evaluateRules = (
  engagement: EngagementResult,
  trend: { trend: Trend; previousScore: number | null },
  recent: EngagementResult | undefined,
  previous: EngagementResult | undefined
): RiskResult => {
  const c = RISK_CONFIG;
  const s = engagement.signals;
  const factors: IRiskFactor[] = [];
  const strengths: string[] = [];
  const add = (code: string, points: number, message: string) => factors.push({ code, points, message });

  // Attendance level (late arrivals count as attended for the requirement)
  const attendanceRate = rate(engagement);
  if (attendanceRate !== null) {
    if (attendanceRate < c.attendance.criticalPercent) {
      add("ATTENDANCE_CRITICAL", c.attendance.criticalPoints, `Attendance is ${attendanceRate}% (${s.sessionsAttended} of ${s.sessionsCounted} sessions in the last 30 days) — far below the ${c.attendance.requiredPercent}% requirement.`);
    } else if (attendanceRate < c.attendance.requiredPercent) {
      add("ATTENDANCE_LOW", c.attendance.belowRequiredPoints, `Attendance is ${attendanceRate}% (${s.sessionsAttended} of ${s.sessionsCounted} sessions in the last 30 days) — below the ${c.attendance.requiredPercent}% requirement.`);
    } else {
      strengths.push(`Attendance ${attendanceRate}% meets the ${c.attendance.requiredPercent}% requirement.`);
    }
  }

  // Attendance trend: last 14 days vs the 14 days before
  const recentRate = rate(recent);
  const previousRate = rate(previous);
  if (
    recentRate !== null &&
    previousRate !== null &&
    (recent?.signals.sessionsCounted ?? 0) >= c.attendance.minSessionsForTrend &&
    (previous?.signals.sessionsCounted ?? 0) >= c.attendance.minSessionsForTrend &&
    previousRate - recentRate >= c.attendance.declinePercentPoints
  ) {
    add("ATTENDANCE_DECLINING", c.attendance.declinePoints, `Attendance has declined from ${previousRate}% to ${recentRate}% over the last ${c.attendance.trendWindowDays} days.`);
  }

  // Quiz performance
  if (s.quizAverage !== null) {
    if (s.quizAverage < c.quiz.failingPercent) {
      add("QUIZ_FAILING", c.quiz.failingPoints, `Quiz average (last 30 days) is ${s.quizAverage}% — below the ${c.quiz.failingPercent}% pass threshold.`);
    } else if (s.quizAverage < c.quiz.lowPercent) {
      add("QUIZ_LOW", c.quiz.lowPoints, `Quiz average (last 30 days) is ${s.quizAverage}% — below the ${c.quiz.lowPercent}% target.`);
    } else {
      strengths.push(`Quiz average ${s.quizAverage}%.`);
    }
  }

  // Assignment completion
  if (s.assignmentCompletionRate !== null) {
    const missing = s.assignmentsDue - s.assignmentsCompleted;
    if (s.assignmentCompletionRate < c.assignments.poorCompletionPercent) {
      add("ASSIGNMENTS_POOR", c.assignments.poorPoints, `Only ${s.assignmentsCompleted} of ${s.assignmentsDue} due assignments submitted (${s.assignmentCompletionRate}%); ${missing} missing.`);
    } else if (s.assignmentCompletionRate < c.assignments.lowCompletionPercent) {
      add("ASSIGNMENTS_LOW", c.assignments.lowPoints, `Assignment completion is ${s.assignmentCompletionRate}% (${missing} missing).`);
    } else {
      strengths.push(`Assignment completion ${s.assignmentCompletionRate}%.`);
    }
  }

  // Overall engagement level and direction
  const score = engagement.overallScore;
  if (score !== null) {
    if (score < c.engagement.veryLowScore) {
      add("ENGAGEMENT_VERY_LOW", c.engagement.veryLowPoints, `Engagement score is ${score}/100 (below ${c.engagement.veryLowScore}).`);
    } else if (score < c.engagement.lowScore) {
      add("ENGAGEMENT_LOW", c.engagement.lowPoints, `Engagement score is ${score}/100 (below ${c.engagement.lowScore}).`);
    }
  }
  if (trend.trend === "DOWN" && score !== null && trend.previousScore !== null) {
    add("ENGAGEMENT_DECLINING", c.engagement.decliningPoints, `Engagement score has decreased from ${trend.previousScore} to ${score} in the last week.`);
  }

  // Participation
  if (s.participationAverage !== null && s.participationAverage < c.participation.lowScore) {
    add("PARTICIPATION_LOW", c.participation.points, `Class participation is low (${s.participationAverage}/100 from teacher ratings).`);
  }

  const points = factors.reduce((sum, f) => sum + f.points, 0);
  // Without attendance, quiz or assignment data there is nothing reliable to assess
  const hasCoreData = attendanceRate !== null || s.quizAverage !== null || s.assignmentCompletionRate !== null;
  factors.sort((a, b) => b.points - a.points);

  return {
    studentId: engagement.studentId,
    level: hasCoreData ? levelFor(points) : null,
    points,
    factors,
    strengths,
    signals: {
      attendanceRate,
      recentAttendanceRate: recentRate,
      previousAttendanceRate: previousRate,
      quizAverage: s.quizAverage,
      assignmentCompletionRate: s.assignmentCompletionRate,
      engagementScore: score,
      engagementTrend: trend.trend,
      engagementPrevious: trend.previousScore,
      participation: s.participationAverage,
    },
  };
};

/** Risk for many students at a point in time (batched). */
export const computeRiskBatch = async (
  studentIds: string[],
  { asOf = new Date(), subjectIds }: { asOf?: Date; subjectIds?: mongoose.Types.ObjectId[] } = {}
) => {
  const tw = RISK_CONFIG.attendance.trendWindowDays;
  const [{ current, trends }, recent, previous] = await Promise.all([
    computeEngagementWithTrend(studentIds, { asOf, subjectIds }),
    computeEngagementBatch(studentIds, { asOf, subjectIds, windowDays: tw }),
    computeEngagementBatch(studentIds, { asOf: new Date(asOf.getTime() - tw * DAY), subjectIds, windowDays: tw }),
  ]);
  const results = new Map<string, RiskResult>();
  for (const [id, engagement] of current) {
    results.set(id, evaluateRules(engagement, trends.get(id)!, recent.get(id), previous.get(id)));
  }
  return { results, engagement: current, engagementTrends: trends };
};

/** Risk now + one week ago, so the UI can show whether risk is rising. */
export const computeRiskWithTrend = async (studentIds: string[], options: { subjectIds?: mongoose.Types.ObjectId[] } = {}) => {
  const now = new Date();
  const [currentBatch, weekAgo] = await Promise.all([
    computeRiskBatch(studentIds, { asOf: now, ...options }),
    computeRiskBatch(studentIds, { asOf: new Date(now.getTime() - 7 * DAY), ...options }),
  ]);
  const previousLevels = new Map([...weekAgo.results].map(([id, r]) => [id, { level: r.level, points: r.points }]));
  return { ...currentBatch, previousLevels };
};

export const riskDirection = (current: RiskResult, previous?: { level: RiskLevel | null; points: number }) => {
  if (!previous || current.level === null || previous.level === null) return "NEW";
  if (current.points > previous.points) return "RISING";
  if (current.points < previous.points) return "FALLING";
  return "STEADY";
};

/** Persist today's snapshot for each student (overall view only). */
export const saveRiskSnapshots = async (results: Map<string, RiskResult>, students: IStudent[]) => {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const byId = new Map(students.map((s) => [s.studentId, s]));
  const ops = [...results.values()]
    .filter((r) => r.level !== null && byId.has(r.studentId))
    .map((r) => {
      const st = byId.get(r.studentId)!;
      return {
        updateOne: {
          filter: { studentId: r.studentId, snapshotDate },
          update: {
            $set: {
              student: st._id,
              studentName: st.name,
              classId: st.classId,
              className: st.className,
              riskLevel: r.level as RiskLevel,
              points: r.points,
              reasons: r.factors.map((f) => f.message),
              factors: r.factors,
              attendanceRate: r.signals.attendanceRate,
              quizAverage: r.signals.quizAverage,
              assignmentCompletionRate: r.signals.assignmentCompletionRate,
              engagementScore: r.signals.engagementScore,
              engineVersion: RISK_CONFIG.engineVersion,
              evaluatedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });
  if (ops.length) await RiskAssessment.bulkWrite(ops);
};
