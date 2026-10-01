import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import mongoose from "mongoose";
import {
  Assignment,
  AttendanceRecord,
  AttendanceSession,
  QuizResult,
  Recommendation,
  IStudent,
  IRecommendationItem,
  RECOMMENDATION_CATEGORIES,
  RecommendationCategory,
  Priority,
} from "../models";
import { RISK_CONFIG } from "../config/analytics";
import { computeRiskBatch, RiskResult } from "./riskService";
import { EngagementResult } from "./engagementService";

/**
 * Academic recommendations grounded ONLY in recorded data.
 *
 * 1. The server builds a numbered list of facts (F1..Fn) from the database.
 * 2. Claude (when configured) writes recommendations and must cite fact ids for each one;
 *    items citing no valid fact are discarded and cited ids are resolved back to the
 *    server's own fact text — the model cannot invent supporting evidence.
 * 3. If AI is not configured, errors, refuses, or returns nothing usable, a deterministic
 *    rule engine produces the recommendations and they are labelled RULE_BASED.
 *
 * No names, emails, IDs, passwords, tokens, face data or locations are ever sent to the AI.
 */

export const RECOMMENDATION_ENGINE_VERSION = "recommendations-v1";
const DAY = 24 * 60 * 60 * 1000;

export const AI_CONFIG = {
  model: process.env.AI_MODEL || "claude-opus-5-5",
  enabled: process.env.AI_RECOMMENDATIONS_ENABLED !== "false",
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 90_000,
};

export const isAiConfigured = () =>
  AI_CONFIG.enabled && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// ------------------------------------------------------------------
// Facts
// ------------------------------------------------------------------

export interface Fact {
  id: string;
  text: string;
}

interface SubjectStat {
  subject: string;
  sessions: number;
  attended: number;
  attendanceRate: number | null;
  quizAverage: number | null;
}

interface Context {
  facts: Fact[];
  risk: RiskResult;
  engagement: EngagementResult;
  subjects: SubjectStat[];
  overdue: { title: string; subject: string; dueDate: Date }[];
  upcoming: { title: string; subject: string; dueDate: Date }[];
}

const loadSubjectStats = async (studentId: string): Promise<SubjectStat[]> => {
  const since = new Date(Date.now() - 30 * DAY);
  const [records, quizzes] = await Promise.all([
    AttendanceRecord.find({ studentId, markedAt: { $gte: since }, status: { $ne: "EXCUSED" } }).select("sessionId status"),
    QuizResult.find({ studentId, dateTaken: { $gte: since } }).select("subjectName percentage"),
  ]);
  const sessions = await AttendanceSession.find({ _id: { $in: records.map((r) => r.sessionId) } }).select("subjectName");
  const subjectOf = new Map(sessions.map((s) => [String(s._id), s.subjectName]));
  const map = new Map<string, { sessions: number; attended: number; quiz: number[] }>();
  const get = (name: string) => map.get(name) || map.set(name, { sessions: 0, attended: 0, quiz: [] }).get(name)!;
  for (const r of records) {
    const name = subjectOf.get(String(r.sessionId));
    if (!name) continue;
    const s = get(name);
    s.sessions++;
    if (r.status === "PRESENT" || r.status === "LATE") s.attended++;
  }
  for (const q of quizzes) get(q.subjectName).quiz.push(q.percentage);
  return [...map.entries()].map(([subject, s]) => ({
    subject,
    sessions: s.sessions,
    attended: s.attended,
    attendanceRate: s.sessions ? Math.round((s.attended / s.sessions) * 100) : null,
    quizAverage: s.quiz.length ? Math.round(s.quiz.reduce((a, b) => a + b, 0) / s.quiz.length) : null,
  }));
};

export const buildContext = async (student: IStudent): Promise<Context> => {
  const [{ results, engagement }, subjects, assignments] = await Promise.all([
    computeRiskBatch([student.studentId]),
    loadSubjectStats(student.studentId),
    Assignment.find({ studentId: student.studentId, status: "PENDING" }).select("title subjectName dueDate").sort({ dueDate: 1 }),
  ]);
  const risk = results.get(student.studentId)!;
  const eng = engagement.get(student.studentId)!;
  const now = Date.now();
  const overdue = assignments.filter((a) => a.dueDate.getTime() < now).map((a) => ({ title: a.title, subject: a.subjectName, dueDate: a.dueDate }));
  const upcoming = assignments
    .filter((a) => a.dueDate.getTime() >= now && a.dueDate.getTime() < now + 14 * DAY)
    .map((a) => ({ title: a.title, subject: a.subjectName, dueDate: a.dueDate }));

  const facts: Fact[] = [];
  const add = (text: string) => facts.push({ id: `F${facts.length + 1}`, text });
  add(`Risk indicator level: ${risk.level ?? "not enough data"} (${risk.points} rule points).`);
  for (const f of risk.factors) add(f.message);
  for (const s of risk.strengths) add(`Strength: ${s}`);
  if (eng.overallScore !== null) add(`Engagement score: ${eng.overallScore}/100 over the last ${eng.windowDays} days.`);
  for (const c of Object.values(eng.components)) {
    add(c.score === null ? `${c.label}: no data in the last ${eng.windowDays} days.` : `${c.label}: ${c.score}/100 (${c.detail}).`);
  }
  for (const s of subjects) {
    const parts = [];
    if (s.attendanceRate !== null) parts.push(`attendance ${s.attendanceRate}% (${s.attended}/${s.sessions} sessions)`);
    if (s.quizAverage !== null) parts.push(`quiz average ${s.quizAverage}%`);
    if (parts.length) add(`${s.subject}: ${parts.join(", ")}.`);
  }
  for (const a of overdue) add(`Overdue assignment: "${a.title}" (${a.subject}), due ${a.dueDate.toDateString()}.`);
  for (const a of upcoming) add(`Upcoming assignment: "${a.title}" (${a.subject}), due ${a.dueDate.toDateString()}.`);

  return { facts, risk, engagement: eng, subjects, overdue, upcoming };
};

const factIdsMatching = (ctx: Context, ...needles: string[]) =>
  ctx.facts.filter((f) => needles.some((n) => f.text.includes(n))).map((f) => f.text);

const priorityForLevel = (level: string | null): Priority => (level === "HIGH" ? "HIGH" : level === "MEDIUM" ? "MEDIUM" : "LOW");

// ------------------------------------------------------------------
// Deterministic rule engine (always available)
// ------------------------------------------------------------------

export const ruleBasedRecommendations = (ctx: Context) => {
  const { risk, subjects, overdue, upcoming } = ctx;
  const items: IRecommendationItem[] = [];
  const codes = new Set(risk.factors.map((f) => f.code));
  const s = ctx.engagement.signals;
  const push = (item: Omit<IRecommendationItem, "supportingFactors">, factors: string[]) =>
    items.push({ ...item, supportingFactors: factors.length ? factors : [ctx.facts[0].text] });

  if (codes.has("ATTENDANCE_CRITICAL") || codes.has("ATTENDANCE_LOW")) {
    const required = RISK_CONFIG.attendance.requiredPercent / 100;
    // Sessions in a row needed to reach the requirement: (a + n) / (t + n) >= required
    const needed = Math.max(0, Math.ceil((required * s.sessionsCounted - s.sessionsAttended) / (1 - required)));
    const weakest = subjects.filter((x) => x.attendanceRate !== null).sort((a, b) => (a.attendanceRate as number) - (b.attendanceRate as number))[0];
    push(
      {
        action: "Attend every upcoming session",
        description: `Attending the next ${needed} session${needed === 1 ? "" : "s"} without absence brings attendance back to ${RISK_CONFIG.attendance.requiredPercent}%.${weakest ? ` Start with ${weakest.subject} (${weakest.attendanceRate}%).` : ""}`,
        priority: codes.has("ATTENDANCE_CRITICAL") ? "HIGH" : "MEDIUM",
        category: "ATTENDANCE",
        audience: "STUDENT",
      },
      factIdsMatching(ctx, "Attendance is", weakest ? `${weakest.subject}:` : "\u0000")
    );
  }
  if (codes.has("ATTENDANCE_DECLINING")) {
    push(
      {
        action: "Check in about recent absences",
        description: "Have a short one-to-one conversation to understand the recent drop in attendance and agree on a plan.",
        priority: "HIGH",
        category: "TEACHER_INTERVENTION",
        audience: "TEACHER",
      },
      factIdsMatching(ctx, "Attendance has declined")
    );
    if (risk.level === "HIGH") {
      push(
        {
          action: "Consider informing the guardian",
          description: "If attendance does not improve within a week, inform the parent/guardian through the institution's usual channel.",
          priority: "MEDIUM",
          category: "PARENT_COMMUNICATION",
          audience: "TEACHER",
        },
        factIdsMatching(ctx, "Attendance has declined", "Risk indicator level")
      );
    }
  }
  if (codes.has("QUIZ_FAILING") || codes.has("QUIZ_LOW")) {
    const weakest = subjects.filter((x) => x.quizAverage !== null).sort((a, b) => (a.quizAverage as number) - (b.quizAverage as number))[0];
    push(
      {
        action: weakest ? `Revise ${weakest.subject} fundamentals` : "Revise recent quiz topics",
        description: `Spend 30 minutes a day for the next week revising the topics from your lowest quiz scores${weakest ? ` in ${weakest.subject} (${weakest.quizAverage}%)` : ""}, then attempt practice questions.`,
        priority: codes.has("QUIZ_FAILING") ? "HIGH" : "MEDIUM",
        category: "REVISION",
        audience: "STUDENT",
      },
      factIdsMatching(ctx, "Quiz average", weakest ? `${weakest.subject}:` : "\u0000")
    );
    if (codes.has("QUIZ_FAILING")) {
      push(
        {
          action: "Offer extra practice material",
          description: "Share a short practice set on the weakest topics and review it with the student after the next class.",
          priority: "MEDIUM",
          category: "EXTRA_PRACTICE",
          audience: "TEACHER",
        },
        factIdsMatching(ctx, "Quiz average")
      );
    }
  }
  if (codes.has("ASSIGNMENTS_POOR") || codes.has("ASSIGNMENTS_LOW") || overdue.length) {
    push(
      {
        action: overdue.length ? `Submit ${overdue.length} overdue assignment${overdue.length > 1 ? "s" : ""}` : "Plan assignment deadlines",
        description: overdue.length
          ? `Start with "${overdue[0].title}" and ask the subject teacher whether late submission is still accepted.`
          : `Block time this week for ${upcoming[0] ? `"${upcoming[0].title}" (due ${upcoming[0].dueDate.toDateString()})` : "upcoming assignments"} so nothing is missed.`,
        priority: codes.has("ASSIGNMENTS_POOR") ? "HIGH" : "MEDIUM",
        category: "ASSIGNMENT_SUPPORT",
        audience: "STUDENT",
      },
      factIdsMatching(ctx, "assignments submitted", "Overdue assignment", "Upcoming assignment")
    );
  }
  if (codes.has("PARTICIPATION_LOW")) {
    push(
      {
        action: "Encourage class participation",
        description: "Invite the student to answer one question or lead one discussion point per session; pair them with an active peer for group work.",
        priority: "LOW",
        category: "MENTORING",
        audience: "TEACHER",
      },
      factIdsMatching(ctx, "participation")
    );
  }
  if (codes.has("ENGAGEMENT_DECLINING") || codes.has("ENGAGEMENT_VERY_LOW")) {
    push(
      {
        action: "Review progress next week",
        description: "Re-check this student's engagement and risk indicator in one week to confirm the actions are working.",
        priority: "MEDIUM",
        category: "FOLLOW_UP",
        audience: "TEACHER",
      },
      factIdsMatching(ctx, "Engagement score")
    );
  }
  if (items.length === 0) {
    const nextDue = upcoming[0];
    push(
      {
        action: "Keep your current routine",
        description: nextDue
          ? `You are on track. Next up: "${nextDue.title}" (${nextDue.subject}) due ${nextDue.dueDate.toDateString()}.`
          : "You are on track. Keep attending regularly and log your self-study to maintain your engagement.",
        priority: "LOW",
        category: "EXTRA_PRACTICE",
        audience: "STUDENT",
      },
      factIdsMatching(ctx, "Strength:", "Upcoming assignment")
    );
  }

  const priority = priorityForLevel(risk.level);
  const summary =
    risk.level === "HIGH"
      ? `Several warning signs need prompt action: ${risk.factors.slice(0, 2).map((f) => f.message.replace(/\.$/, "").toLowerCase()).join("; ")}.`
      : risk.level === "MEDIUM"
      ? `Some areas need attention: ${risk.factors.slice(0, 2).map((f) => f.message.replace(/\.$/, "").toLowerCase()).join("; ")}.`
      : risk.level === "LOW"
      ? "The student is on track based on recent attendance, quizzes and assignments."
      : "There is not enough recent data to give targeted recommendations yet.";
  return { summary, priority, recommendations: items.slice(0, 6) };
};

// ------------------------------------------------------------------
// Claude
// ------------------------------------------------------------------

const AiOutput = z.object({
  summary: z.string(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  recommendations: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
      category: z.enum(RECOMMENDATION_CATEGORIES),
      audience: z.enum(["STUDENT", "TEACHER"]),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      factIds: z.array(z.string()),
    })
  ),
});

const SYSTEM_PROMPT = `You are an academic advisor assistant inside a college attendance and engagement system.
You receive a numbered list of facts about ONE student, taken from the institution's database. Write practical
recommendations for the student and for their teacher.

Rules:
- Use only the facts provided. Do not assume anything else about the student (health, family, finances, motives).
- Every recommendation must cite the ids of the facts that justify it in factIds (e.g. ["F2","F7"]).
- Be specific and actionable (what, how often, by when). Reference subjects and assignments by the names in the facts.
- Address STUDENT items to the student ("you"); TEACHER items describe what the teacher should do.
- Suggest parent/guardian communication only when the risk level is HIGH.
- 2 to 5 recommendations. The summary is 1-2 sentences in plain language.
- Supportive, non-judgemental tone. This is an early-support indicator, not a prediction.`;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: AI_CONFIG.timeoutMs, maxRetries: 1 }));

const generateWithAi = async (ctx: Context) => {
  const factLines = ctx.facts.map((f) => `${f.id}: ${f.text}`).join("\n");
  const response = await getClient().beta.messages.parse({
    model: AI_CONFIG.model,
    max_tokens: 16000,
    // Server-side refusal fallback: if the primary model declines, the API retries on a fallback model
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(AiOutput) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Facts about the student:\n${factLines}\n\nWrite the recommendations.` }],
  });
  if (response.stop_reason === "refusal") throw new Error("AI declined the request");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`AI returned no usable output (stop_reason: ${response.stop_reason})`);

  const factText = new Map(ctx.facts.map((f) => [f.id, f.text]));
  const items: IRecommendationItem[] = [];
  for (const r of parsed.recommendations.slice(0, 6)) {
    const supportingFactors = [...new Set(r.factIds.filter((id) => factText.has(id)).map((id) => factText.get(id)!))];
    if (supportingFactors.length === 0) continue; // ungrounded: discard
    if (r.category === "PARENT_COMMUNICATION" && ctx.risk.level !== "HIGH") continue;
    items.push({
      action: r.action.trim().slice(0, 140),
      description: r.description.trim().slice(0, 600),
      category: r.category,
      audience: r.audience,
      priority: r.priority,
      supportingFactors,
    });
  }
  if (items.length === 0) throw new Error("AI recommendations did not cite any provided facts");
  return { summary: parsed.summary.trim().slice(0, 500), priority: parsed.priority, recommendations: items, model: response.model };
};

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export const generateRecommendation = async (
  student: IStudent,
  { generatedByRole, generatedBy, preferAi = true }: { generatedByRole: "TEACHER" | "STUDENT" | "SYSTEM"; generatedBy?: string; preferAi?: boolean }
) => {
  const ctx = await buildContext(student);
  let result: { summary: string; priority: Priority; recommendations: IRecommendationItem[]; model?: string };
  let source: "AI" | "RULE_BASED" = "RULE_BASED";
  let fallbackReason: string | undefined;

  if (preferAi && isAiConfigured() && ctx.risk.level !== null) {
    try {
      result = await generateWithAi(ctx);
      source = "AI";
    } catch (error) {
      fallbackReason =
        error instanceof Anthropic.APIError
          ? `AI service error (${error.status ?? "network"})`
          : error instanceof Error
          ? error.message.slice(0, 160)
          : "AI generation failed";
      console.warn("[Recommendations] AI unavailable, using rule-based engine:", fallbackReason);
      result = ruleBasedRecommendations(ctx);
    }
  } else {
    fallbackReason = !preferAi
      ? "Rule-based generation requested"
      : !isAiConfigured()
      ? "AI is not configured on this server"
      : "Not enough data for AI recommendations";
    result = ruleBasedRecommendations(ctx);
  }

  await Recommendation.updateMany({ studentId: student.studentId, isActive: true }, { $set: { isActive: false } });
  const doc = await Recommendation.create({
    studentId: student.studentId,
    student: student._id,
    summary: result.summary,
    recommendations: result.recommendations,
    priority: result.priority,
    supportingFactors: [...new Set(result.recommendations.flatMap((r) => r.supportingFactors))].slice(0, 12),
    riskLevel: ctx.risk.level ?? "UNKNOWN",
    source,
    aiModel: source === "AI" ? result.model : undefined,
    fallbackReason: source === "AI" ? undefined : fallbackReason,
    generatedByRole,
    generatedBy: generatedBy && mongoose.Types.ObjectId.isValid(generatedBy) ? new mongoose.Types.ObjectId(generatedBy) : undefined,
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    isActive: true,
    generatedAt: new Date(),
  });
  return doc;
};
