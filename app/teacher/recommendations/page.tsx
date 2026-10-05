"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { RecommendationCard, RecommendationData, SourceBadge } from "@/components/recommendations/RecommendationCard";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Lightbulb, Sparkles, ListChecks, RefreshCw, AlertTriangle } from "lucide-react";

interface Row {
  studentId: string;
  name: string;
  className: string;
  riskLevel: string;
  topReason: string | null;
  recommendation: RecommendationData | null;
}

interface ListData {
  students: Row[];
  filters: { classes: { id: string; name: string; division: string }[] };
  aiConfigured: boolean;
  model: string | null;
}

export default function TeacherRecommendationsPage() {
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  // Deep link from the risk page: /teacher/recommendations?studentId=S103
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("studentId")?.toUpperCase() ?? null
  );
  const [generating, setGenerating] = useState<"auto" | "rule" | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiFetch<ListData>(`/teacher/recommendations${classId ? `?classId=${classId}` : ""}`).then((res) => {
        if (res.success && res.data) {
          setData(res.data);
          setError(null);
        } else setError(res.error || "Could not load recommendations.");
      }),
    [classId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => data?.students.find((s) => s.studentId === selected) ?? data?.students[0] ?? null, [data, selected]);

  const generate = async (mode: "auto" | "rule") => {
    if (!current) return;
    setGenerating(mode);
    setGenError(null);
    const res = await apiFetch<RecommendationData>(`/teacher/students/${current.studentId}/recommendations`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    setGenerating(null);
    if (res.success && res.data) {
      const rec = res.data;
      setData((d) => d && { ...d, students: d.students.map((s) => (s.studentId === current.studentId ? { ...s, recommendation: rec } : s)) });
    } else setGenError(res.error || "Generation failed.");
  };

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Recommendations" subtitle="Actionable next steps for each student, grounded in their recorded academic data" defaultRole="TEACHER">
        <div className="space-y-6">
          {data && (
            <div className="flex gap-3 p-4 rounded-lg bg-brand-50/60 border border-brand-100 text-xs text-brand-900">
              <Sparkles className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {data.aiConfigured
                  ? `AI generation is enabled (${data.model}). Only anonymised academic facts are sent — never names, IDs, face or location data. Every recommendation cites the recorded facts it is based on.`
                  : "AI generation is not configured on this server, so recommendations come from the transparent rule engine and are labelled “Rule-based”."}
              </span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
            <Card className="lg:col-span-1 min-w-0">
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle>Students by risk</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Select a student to view their academic insight</p>
                </div>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                >
                  <option value="">All my classes</option>
                  {data?.filters.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.division})
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent className="p-2 max-h-[640px] overflow-y-auto">
                {!data ? (
                  <p className="text-xs text-slate-500 p-6 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-600" /> Loading…
                  </p>
                ) : data.students.length === 0 ? (
                  <p className="text-xs text-slate-500 p-6 text-center">No students in your classes.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.students.map((s) => (
                      <li key={s.studentId}>
                        <button
                          onClick={() => setSelected(s.studentId)}
                          className={cn(
                            "relative w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
                            current?.studentId === s.studentId ? "bg-brand-50 border-brand-200 before:absolute before:left-0 before:inset-y-2 before:w-[3px] before:rounded-full before:bg-accent-500" : "border-transparent hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-brand-950 truncate">{s.name}</span>
                            <RiskBadge level={s.riskLevel} />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {s.studentId} • {s.className} • {s.recommendation ? s.recommendation.sourceLabel : "No recommendation yet"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 min-w-0 border-l-[3px] border-l-accent-500">
              <CardHeader className="space-y-2">
                <p className="eyebrow !text-accent-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI academic insights
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-accent-600" />
                    {current ? `${current.name} (${current.studentId})` : "Select a student"}
                    {current && <RiskBadge level={current.riskLevel} />}
                  </CardTitle>
                  {current && (
                    <div className="flex flex-wrap gap-2">
                      {data?.aiConfigured && (
                        <Button size="sm" disabled={generating !== null} onClick={() => generate("auto")}>
                          <Sparkles className="w-3.5 h-3.5" /> {generating === "auto" ? "Generating with AI…" : "Generate with AI"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={generating !== null} onClick={() => generate("rule")}>
                        <ListChecks className="w-3.5 h-3.5" /> {generating === "rule" ? "Generating…" : "Generate rule-based"}
                      </Button>
                    </div>
                  )}
                </div>
                {current?.topReason && <p className="text-xs text-slate-500">Top risk reason: {current.topReason}</p>}
              </CardHeader>
              <CardContent>
                {genError && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">{genError}</p>}
                {generating === "auto" && (
                  <p className="text-xs text-brand-800 bg-brand-50/60 border border-brand-100 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-brand-600" /> Asking the AI model — this can take up to a minute. It falls back to the rule engine if unavailable.
                  </p>
                )}
                {!current ? null : current.recommendation ? (
                  <RecommendationCard rec={current.recommendation} showReason />
                ) : (
                  <div className="text-center py-12 space-y-2 flex flex-col items-center">
                    <span className="w-11 h-11 rounded-full bg-accent-50 border border-accent-100 text-accent-600 flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
                    <p className="text-sm font-semibold text-brand-950">No recommendation yet</p>
                    <p className="text-xs text-slate-500">Generate one to get specific next steps for this student and for you.</p>
                  </div>
                )}
                {current?.recommendation && (
                  <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    Student-addressed actions are shown to the student; teacher actions stay visible to staff only. <SourceBadge rec={current.recommendation} />
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
