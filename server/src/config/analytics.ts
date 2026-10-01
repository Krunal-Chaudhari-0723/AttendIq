/**
 * Explicit, auditable parameters for engagement scoring and the academic risk indicator.
 * Change values here; every UI explanation is generated from these numbers.
 */

export const ENGAGEMENT_CONFIG = {
  engineVersion: "engagement-v1",
  // Specification weights (must sum to 1)
  weights: {
    attendance: 0.3,
    quiz: 0.25,
    assignments: 0.2,
    participation: 0.15,
    learningActivity: 0.1,
  },
  // Evaluation window: only activity in the last N days counts
  windowDays: 30,
  // A LATE arrival counts as this fraction of a full PRESENT
  lateCredit: 0.75,
  // Assignment component = completion rate * this share + average grade * the rest
  assignmentCompletionShare: 0.5,
  // Learning activity: minutes of logged learning in the window that count as 100%
  learningTargetMinutes: 300,
  // A completed recommendation action counts as this many learning minutes
  recommendationActionMinutes: 30,
  // Points difference vs the previous window to call a trend UP / DOWN
  trendDelta: 3,
  // Weekly history points shown on charts
  historyWeeks: 6,
};

/**
 * Academic risk INDICATOR (not a prediction). Each rule that fires adds points and a reason.
 *   total >= high.minPoints   -> HIGH
 *   total >= medium.minPoints -> MEDIUM
 *   otherwise                 -> LOW
 */
export const RISK_CONFIG = {
  engineVersion: "risk-v1",
  levels: { high: { minPoints: 6 }, medium: { minPoints: 3 } },
  attendance: {
    requiredPercent: 75, // institutional attendance requirement
    criticalPercent: 60,
    belowRequiredPoints: 2,
    criticalPoints: 3,
    // Compare the last `trendWindowDays` with the window before it
    trendWindowDays: 14,
    declinePercentPoints: 15,
    declinePoints: 2,
    minSessionsForTrend: 3,
  },
  quiz: { lowPercent: 60, failingPercent: 50, lowPoints: 1, failingPoints: 2 },
  assignments: { lowCompletionPercent: 80, poorCompletionPercent: 60, lowPoints: 1, poorPoints: 2 },
  engagement: { lowScore: 65, veryLowScore: 50, lowPoints: 1, veryLowPoints: 2, decliningPoints: 1 },
  participation: { lowScore: 34, points: 1 },
};

export type EngagementComponentKey = keyof typeof ENGAGEMENT_CONFIG.weights;

export const ENGAGEMENT_LABELS: Record<EngagementComponentKey, string> = {
  attendance: "Attendance",
  quiz: "Quiz Performance",
  assignments: "Assignments",
  participation: "Participation",
  learningActivity: "Learning Activity",
};
