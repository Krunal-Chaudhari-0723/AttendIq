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
        <div className="space-y-6 max-w-6xl">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
              <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </Button>
            </div>
          )}

          {!data && !error && (
            <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Computing your engagement score…
            </div>
          )}

          {data && (
            <>
              {/* Headline */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-bold">
                    Engagement score • last {data.methodology.windowDays} days
                  </span>
                  <h2 className="text-4xl font-extrabold">
                    {data.overallScore ?? "—"} <span className="text-lg font-normal text-slate-400">/ 100</span>
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xl">
                    {data.overallScore === null
                      ? "There is not enough recent data to compute a reliable score yet."
                      : data.missingComponents.length
                      ? `Computed from ${Math.round(data.coverage * 100)}% of the weighted signals; components without data are left out rather than guessed.`
                      : "Computed from all five weighted signals."}
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <TrendBadge trend={data.trend.trend} delta={delta} />
                  <p className="text-[11px] text-slate-400">
                    {data.trend.previousScore !== null ? `One week ago: ${data.trend.previousScore}/100` : "No score one week ago"}
                  </p>
                </div>
              </div>

              <ComponentBreakdown components={data.components} />

              <AcademicStanding />

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-600" /> Weekly engagement trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendLine data={data.history.map((h) => ({ label: formatDate(h.date).replace(/, \d{4}$/, ""), value: h.score }))} valueName="Engagement" />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Info className="w-4 h-4 text-indigo-600" /> How this score is calculated
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-slate-600 space-y-2">
                    <div className="p-2.5 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
                      Attendance×0.30 + Quiz×0.25 + Assignments×0.20 + Participation×0.15 + Learning×0.10
                    </div>
                    <ul className="space-y-1.5 list-disc pl-4">
                      {data.explanation.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-400">
                      Late arrivals count {data.methodology.lateCredit * 100}%. Trend compares with your score one week earlier (±
                      {data.methodology.trendDelta} points).
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Learning activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4 text-indigo-600" /> Log learning activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={logActivity} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={form.type}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          <option value="STUDY_SESSION">Self study</option>
                          <option value="PRACTICE">Practice / exercises</option>
                        </select>
                        <select
                          value={form.subjectId}
                          onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs"
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
                      <div className="flex items-center gap-3">
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
                      {formMsg && <p className={`text-xs ${formMsg.ok ? "text-emerald-700" : "text-rose-700"}`}>{formMsg.text}</p>}
                      <p className="text-[11px] text-slate-400">
                        Self-reported. {data.methodology.learningTargetMinutes} minutes in {data.methodology.windowDays} days counts as
                        100% for this 10% component.
                      </p>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" /> Recent learning activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.recentActivities.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No learning activity logged yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.recentActivities.map((a) => (
                          <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                            <div>
                              <p className="font-semibold text-slate-800">{a.title}</p>
                              <p className="text-slate-400">
                                {a.subjectName || "General"} • {formatDate(a.occurredAt)}
                                {a.type === "RECOMMENDATION_ACTION" ? " • recommendation completed" : ""}
                              </p>
                            </div>
                            <Badge variant="neutral" size="sm">{a.minutes} min</Badge>
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
