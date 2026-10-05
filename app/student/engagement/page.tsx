"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendLine } from "@/components/charts/TrendLine";
import { TrendBadge } from "@/components/engagement/TrendBadge";
import { AcademicStanding } from "@/components/risk/AcademicStanding";
import { ComponentBreakdown, EngagementComponent, EngagementKey } from "@/components/engagement/ComponentBreakdown";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Activity, Info, RefreshCw, AlertTriangle, BookOpen, Plus } from "lucide-react";

interface EngagementData {
  overallScore: number | null;
  coverage: number;
  missingComponents: EngagementKey[];
  components: Record<EngagementKey, EngagementComponent>;
  explanation: string[];
  trend: { trend: "UP" | "DOWN" | "STABLE" | "NEW"; previousScore: number | null };
  history: { date: string; score: number | null }[];
  recentActivities: { id: string; type: string; title: string; minutes: number; subjectName?: string; occurredAt: string }[];
  methodology: { windowDays: number; lateCredit: number; learningTargetMinutes: number; trendDelta: number };
}

export default function StudentEngagementPage() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ type: "STUDY_SESSION", title: "", minutes: 30, subjectId: "" });
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    apiFetch<EngagementData>("/student/engagement").then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load engagement.");
    });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    apiFetch<{ subjects: { id: string; name: string }[] }>("/student/subjects").then((res) => {
      if (res.success && res.data) setSubjects(res.data.subjects);
    });
  }, []);

  const logActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormMsg(null);
    const res = await apiFetch("/student/learning-activities", {
      method: "POST",
      body: JSON.stringify({ ...form, minutes: Number(form.minutes), subjectId: form.subjectId || undefined }),
    });
    setSaving(false);
    if (res.success) {
      setFormMsg({ ok: true, text: "Activity logged. Your Learning Activity score has been updated." });
      setForm({ ...form, title: "" });
      setReloadKey((k) => k + 1);
    } else setFormMsg({ ok: false, text: res.error || "Could not log activity." });
  };

  const delta =
    data && data.overallScore !== null && data.trend.previousScore !== null ? data.overallScore - data.trend.previousScore : null;

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell
        title="My Engagement"
        subtitle="A transparent score computed from your attendance, quizzes, assignments, participation and learning activity"
        defaultRole="STUDENT"
      >
        <div className="space-y-5 sm:space-y-6 max-w-6xl">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </Button>
            </div>
          )}

          {!data && !error && (
            <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-[var(--shadow-card)]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" /> Computing your engagement score…
            </div>
          )}

          {data && (
            <>
              {/* Headline */}
              <div className="rounded-xl bg-brand-900 text-white p-5 sm:p-6 border border-brand-800 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
                <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" />
                <div className="space-y-1.5 min-w-0">
                  <span className="eyebrow text-accent-300">
                    Engagement score • last {data.methodology.windowDays} days
                  </span>
                  <h2 className="text-3xl font-semibold tabular-nums">
                    {data.overallScore ?? "—"} <span className="text-base font-normal text-brand-100/75">/ 100</span>
                  </h2>
                  {data.overallScore !== null && (
                    <div className="h-2 w-full max-w-sm rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(0, Math.min(100, data.overallScore))}%` }} />
                    </div>
                  )}
                  <p className="text-xs text-brand-100/75 max-w-xl leading-relaxed">
                    {data.overallScore === null
                      ? "There is not enough recent data to compute a reliable score yet."
                      : data.missingComponents.length
                      ? `Computed from ${Math.round(data.coverage * 100)}% of the weighted signals; components without data are left out rather than guessed.`
                      : "Computed from all five weighted signals."}
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <TrendBadge trend={data.trend.trend} delta={delta} />
                  <p className="text-[11px] text-brand-100/75">
                    {data.trend.previousScore !== null ? `One week ago: ${data.trend.previousScore}/100` : "No score one week ago"}
                  </p>
                </div>
              </div>

              <ComponentBreakdown components={data.components} />

              <AcademicStanding />

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
                <Card className="lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-brand-600" /> Weekly engagement trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendLine data={data.history.map((h) => ({ label: formatDate(h.date).replace(/, \d{4}$/, ""), value: h.score }))} valueName="Engagement" />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-brand-600" /> How this score is calculated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-slate-600 space-y-2">
                    <div className="p-3 bg-brand-50/60 rounded-lg font-mono text-[11px] leading-relaxed text-brand-900 border border-brand-100 break-words">
                      Attendance×0.30 + Quiz×0.25 + Assignments×0.20 + Participation×0.15 + Learning×0.10
                    </div>
                    <ul className="space-y-1.5 list-disc pl-4 marker:text-accent-500 leading-relaxed">
                      {data.explanation.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-500">
                      Late arrivals count {data.methodology.lateCredit * 100}%. Trend compares with your score one week earlier (±
                      {data.methodology.trendDelta} points).
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Learning activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-brand-600" /> Log learning activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={logActivity} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={form.type}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                        >
                          <option value="STUDY_SESSION">Self study</option>
                          <option value="PRACTICE">Practice / exercises</option>
                        </select>
                        <select
                          value={form.subjectId}
                          onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                          className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                        >
                          <option value="">General</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        required
                        minLength={3}
                        maxLength={120}
                        placeholder="What did you do? e.g. Solved 10 SQL join problems"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          type="number"
                          min={5}
                          max={240}
                          required
                          value={form.minutes}
                          onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                          className="text-xs w-28"
                        />
                        <span className="text-xs text-slate-500">minutes</span>
                        <Button type="submit" size="sm" disabled={saving} className="ml-auto text-xs">
                          {saving ? "Saving…" : "Log activity"}
                        </Button>
                      </div>
                      {formMsg && <p className={`p-3 rounded-lg border text-xs animate-fadeIn ${formMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{formMsg.text}</p>}
                      <p className="text-[11px] text-slate-500">
                        Self-reported. {data.methodology.learningTargetMinutes} minutes in {data.methodology.windowDays} days counts as
                        100% for this 10% component.
                      </p>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-600" /> Recent learning activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.recentActivities.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No learning activity logged yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.recentActivities.map((a) => (
                          <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-brand-950">{a.title}</p>
                              <p className="text-slate-500">
                                {a.subjectName || "General"} • {formatDate(a.occurredAt)}
                                {a.type === "RECOMMENDATION_ACTION" ? " • recommendation completed" : ""}
                              </p>
                            </div>
                            <Badge variant="brand" size="sm" className="tabular-nums shrink-0">{a.minutes} min</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
