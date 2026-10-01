import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  QuizResult,
  Assignment,
  ParticipationRecord,
  LearningActivity,
  EngagementScore,
  IEngagementComponents,
} from "../models";
import { ENGAGEMENT_CONFIG, ENGAGEMENT_LABELS, EngagementComponentKey } from "../config/analytics";

/**
 * Engagement Intelligence — transparent weighted score (0-100) computed only from stored records.
 *
 *   Attendance 30% + Quiz 25% + Assignments 20% + Participation 15% + Learning Activity 10%
 *
 * If a component has no data in the evaluation window it is reported as missing and its weight
 * is redistributed proportionally across the components that do have data (never invented).
 */

const DAY = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const KEYS = Object.keys(ENGAGEMENT_CONFIG.weights) as EngagementComponentKey[];
const MIN_COVERAGE = 0.3;

export interface ComponentResult {
  key: EngagementComponentKey;
  label: string;
  weight: number;
  score: number | null;
  contribution: number | null; // weighted points after redistribution
  detail: string;
  sampleSize: number;
}

export interface EngagementResult {
  studentId: string;
  overallScore: number | null;
  components: Record<EngagementComponentKey, ComponentResult>;
  coverage: number;
  missingComponents: EngagementComponentKey[];
  explanation: string[];
  windowStart: Date;
  windowEnd: Date;
  windowDays: number;
  // Raw signals reused by the risk indicator
  signals: {
    sessionsCounted: number;
    sessionsAttended: number;
    lateCount: number;
    absentCount: number;
    quizCount: number;
    quizAverage: number | null;
    assignmentsDue: number;
    assignmentsCompleted: number;
    assignmentCompletionRate: number | null;
    assignmentGradeAverage: number | null;
    participationAverage: number | null;
    learningMinutes: number;
  };
}

export interface EngagementOptions {
  asOf?: Date;
  subjectIds?: mongoose.Types.ObjectId[];
  windowDays?: number;
}

/** Compute engagement for many students with one query per data source. */
export const computeEngagementBatch = async (
  studentIds: string[],
  { asOf = new Date(), subjectIds, windowDays = ENGAGEMENT_CONFIG.windowDays }: EngagementOptions = {}
): Promise<Map<string, EngagementResult>> => {
  const windowEnd = asOf;
  const windowStart = new Date(asOf.getTime() - windowDays * DAY);
  const ids = [...new Set(studentIds.map((s) => s.toUpperCase()))];
  const subjectFilter = subjectIds?.length ? { $in: subjectIds } : undefined;

  const [records, quizzes, assignments, participation, activities] = await Promise.all([
    AttendanceRecord.find({
      studentId: { $in: ids },
      status: { $ne: "EXCUSED" },
      markedAt: { $gte: new Date(windowStart.getTime() - DAY), $lte: windowEnd },
    }).select("studentId sessionId status"),
    QuizResult.find({
      studentId: { $in: ids },
      dateTaken: { $gte: windowStart, $lte: windowEnd },
      ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    }).select("studentId percentage"),
    Assignment.find({
      studentId: { $in: ids },
      dueDate: { $gte: windowStart, $lte: windowEnd },
      ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    }).select("studentId status obtainedMarks totalMarks"),
    ParticipationRecord.find({
      studentId: { $in: ids },
      ratedAt: { $gte: windowStart, $lte: windowEnd },
      ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    }).select("studentId rating"),
    LearningActivity.find({
      studentId: { $in: ids },
      occurredAt: { $gte: windowStart, $lte: windowEnd },
      ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    }).select("studentId type minutes"),
  ]);

  // Attendance must be attributed by the session's own start time (and subject when filtering)
  const sessionIds = [...new Set(records.map((r) => String(r.sessionId)))];
  const sessions = await AttendanceSession.find({
    _id: { $in: sessionIds },
    startTime: { $gte: windowStart, $lte: windowEnd },
    ...(subjectFilter ? { subjectId: subjectFilter } : {}),
  }).select("_id");
  const sessionsInWindow = new Set(sessions.map((s) => String(s._id)));

  const group = <T extends { studentId: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const list = map.get(item.studentId) || [];
      list.push(item);
      map.set(item.studentId, list);
    }
    return map;
  };
  const byRecords = group(records.filter((r) => sessionsInWindow.has(String(r.sessionId))));
  const byQuiz = group(quizzes);
  const byAssignment = group(assignments);
  const byParticipation = group(participation);
  const byActivity = group(activities);

  const results = new Map<string, EngagementResult>();
  for (const studentId of ids) {
    // ---- Attendance ----
    const recs = byRecords.get(studentId) || [];
    const present = recs.filter((r) => r.status === "PRESENT").length;
    const late = recs.filter((r) => r.status === "LATE").length;
    const absent = recs.filter((r) => r.status === "ABSENT").length;
    const attendanceScore = recs.length
      ? ((present + late * ENGAGEMENT_CONFIG.lateCredit) / recs.length) * 100
      : null;

    // ---- Quiz ----
    const qs = byQuiz.get(studentId) || [];
    const quizAverage = qs.length ? qs.reduce((s, q) => s + q.percentage, 0) / qs.length : null;

    // ---- Assignments: completion + grade ----
    const as = byAssignment.get(studentId) || [];
    const completed = as.filter((a) => ["SUBMITTED", "GRADED", "LATE"].includes(a.status));
    const graded = as.filter((a) => typeof a.obtainedMarks === "number" && a.totalMarks > 0);
    const completionRate = as.length ? (completed.length / as.length) * 100 : null;
    const gradeAverage = graded.length
      ? graded.reduce((s, a) => s + ((a.obtainedMarks as number) / a.totalMarks) * 100, 0) / graded.length
      : null;
    let assignmentScore: number | null = null;
    if (completionRate !== null) {
      assignmentScore =
        gradeAverage === null
          ? completionRate
          : completionRate * ENGAGEMENT_CONFIG.assignmentCompletionShare +
            gradeAverage * (1 - ENGAGEMENT_CONFIG.assignmentCompletionShare);
    }

    // ---- Participation (teacher ratings 0-3) ----
    const ps = byParticipation.get(studentId) || [];
    const participationScore = ps.length ? (ps.reduce((s, p) => s + p.rating, 0) / ps.length / 3) * 100 : null;

    // ---- Learning activity (minutes vs target) ----
    const acts = byActivity.get(studentId) || [];
    const learningMinutes = acts.reduce(
      (s, a) => s + (a.type === "RECOMMENDATION_ACTION" ? ENGAGEMENT_CONFIG.recommendationActionMinutes : a.minutes),
      0
    );
    const learningScore = acts.length ? Math.min(100, (learningMinutes / ENGAGEMENT_CONFIG.learningTargetMinutes) * 100) : null;

    const raw: Record<EngagementComponentKey, { score: number | null; detail: string; n: number }> = {
      attendance: {
        score: attendanceScore,
        n: recs.length,
        detail: recs.length
          ? `${present + late} of ${recs.length} sessions attended${late ? ` (${late} late, ${ENGAGEMENT_CONFIG.lateCredit * 100}% credit each)` : ""}`
          : "No attendance sessions in this period",
      },
      quiz: {
        score: quizAverage,
        n: qs.length,
        detail: qs.length ? `Average of ${qs.length} quiz result${qs.length > 1 ? "s" : ""}` : "No quiz results in this period",
      },
      assignments: {
        score: assignmentScore,
        n: as.length,
        detail: as.length
          ? `${completed.length} of ${as.length} due assignments submitted${gradeAverage !== null ? `, average grade ${Math.round(gradeAverage)}%` : ""}`
          : "No assignments were due in this period",
      },
      participation: {
        score: participationScore,
        n: ps.length,
        detail: ps.length ? `Teacher participation ratings from ${ps.length} session${ps.length > 1 ? "s" : ""}` : "No participation ratings in this period",
      },
      learningActivity: {
        score: learningScore,
        n: acts.length,
        detail: acts.length
          ? `${learningMinutes} learning minutes logged (target ${ENGAGEMENT_CONFIG.learningTargetMinutes})`
          : "No learning activity logged in this period",
      },
    };

    const availableWeight = KEYS.reduce((s, k) => s + (raw[k].score !== null ? ENGAGEMENT_CONFIG.weights[k] : 0), 0);
    const coverage = Math.round(availableWeight * 100) / 100;
    const missing = KEYS.filter((k) => raw[k].score === null);
    const weightedSum = KEYS.reduce((s, k) => s + (raw[k].score ?? 0) * ENGAGEMENT_CONFIG.weights[k], 0);
    const overall = availableWeight >= MIN_COVERAGE ? Math.round(weightedSum / availableWeight) : null;

    const components = {} as Record<EngagementComponentKey, ComponentResult>;
    for (const k of KEYS) {
      const score = raw[k].score === null ? null : Math.round(raw[k].score as number);
      components[k] = {
        key: k,
        label: ENGAGEMENT_LABELS[k],
        weight: ENGAGEMENT_CONFIG.weights[k],
        score,
        contribution:
          raw[k].score === null || availableWeight === 0
            ? null
            : round1(((raw[k].score as number) * ENGAGEMENT_CONFIG.weights[k]) / availableWeight),
        detail: raw[k].detail,
        sampleSize: raw[k].n,
      };
    }

    const explanation: string[] = KEYS.map((k) =>
      components[k].score === null
        ? `${components[k].label}: no data — its ${ENGAGEMENT_CONFIG.weights[k] * 100}% weight is redistributed. (${components[k].detail})`
        : `${components[k].label}: ${components[k].score}/100 × ${ENGAGEMENT_CONFIG.weights[k] * 100}% weight. ${components[k].detail}.`
    );
    if (overall === null) {
      explanation.push(
        `Not enough data in the last ${windowDays} days to compute a reliable score (needs at least ${MIN_COVERAGE * 100}% of the weight backed by data).`
      );
    } else if (missing.length) {
      explanation.push(
        `Score = weighted points ÷ ${coverage} (share of weight with data) = ${overall}/100.`
      );
    } else {
      explanation.push(`Score = sum of weighted points = ${overall}/100.`);
    }

    results.set(studentId, {
      studentId,
      overallScore: overall,
      components,
      coverage,
      missingComponents: missing,
      explanation,
      windowStart,
      windowEnd,
      windowDays,
      signals: {
        sessionsCounted: recs.length,
        sessionsAttended: present + late,
        lateCount: late,
        absentCount: absent,
        quizCount: qs.length,
        quizAverage: quizAverage === null ? null : Math.round(quizAverage),
        assignmentsDue: as.length,
        assignmentsCompleted: completed.length,
        assignmentCompletionRate: completionRate === null ? null : Math.round(completionRate),
        assignmentGradeAverage: gradeAverage === null ? null : Math.round(gradeAverage),
        participationAverage: participationScore === null ? null : Math.round(participationScore),
        learningMinutes,
      },
    });
  }
  return results;
};

export type Trend = "UP" | "DOWN" | "STABLE" | "NEW";

export const trendBetween = (current: number | null, previous: number | null): Trend => {
  if (current === null || previous === null) return "NEW";
  const diff = current - previous;
  if (diff >= ENGAGEMENT_CONFIG.trendDelta) return "UP";
  if (diff <= -ENGAGEMENT_CONFIG.trendDelta) return "DOWN";
  return "STABLE";
};

export interface HistoryPoint {
  date: string;
  scores: Map<string, number | null>;
}

/** Weekly history (oldest first): the same engine evaluated at past dates. */
export const computeEngagementHistory = async (
  studentIds: string[],
  { asOf = new Date(), subjectIds, weeks = ENGAGEMENT_CONFIG.historyWeeks }: EngagementOptions & { weeks?: number } = {}
): Promise<HistoryPoint[]> => {
  const points: HistoryPoint[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const at = new Date(asOf.getTime() - k * 7 * DAY);
    const batch = await computeEngagementBatch(studentIds, { asOf: at, subjectIds });
    points.push({
      date: at.toISOString().slice(0, 10),
      scores: new Map([...batch].map(([id, r]) => [id, r.overallScore])),
    });
  }
  return points;
};

/** Current results + trend vs one week ago. */
export const computeEngagementWithTrend = async (studentIds: string[], options: EngagementOptions = {}) => {
  const asOf = options.asOf ?? new Date();
  const [current, previous] = await Promise.all([
    computeEngagementBatch(studentIds, { ...options, asOf }),
    computeEngagementBatch(studentIds, { ...options, asOf: new Date(asOf.getTime() - 7 * DAY) }),
  ]);
  const trends = new Map<string, { trend: Trend; previousScore: number | null }>();
  for (const [id, result] of current) {
    const prev = previous.get(id)?.overallScore ?? null;
    trends.set(id, { trend: trendBetween(result.overallScore, prev), previousScore: prev });
  }
  return { current, trends };
};

/** Persist today's snapshot (overall-subject view only) so scores are queryable over time. */
export const saveEngagementSnapshots = async (
  results: Map<string, EngagementResult>,
  trends: Map<string, { trend: Trend }>,
  studentObjectIds: Map<string, mongoose.Types.ObjectId>
) => {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const ops = [...results.values()]
    .filter((r) => studentObjectIds.has(r.studentId))
    .map((r) => ({
      updateOne: {
        filter: { studentId: r.studentId, snapshotDate },
        update: {
          $set: {
            student: studentObjectIds.get(r.studentId),
            overallScore: r.overallScore,
            components: Object.fromEntries(KEYS.map((k) => [k, r.components[k].score])) as unknown as IEngagementComponents,
            missingComponents: r.missingComponents,
            coverage: r.coverage,
            trend: trends.get(r.studentId)?.trend ?? "NEW",
            windowDays: r.windowDays,
            engineVersion: ENGAGEMENT_CONFIG.engineVersion,
            evaluatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
  if (ops.length) await EngagementScore.bulkWrite(ops);
};
