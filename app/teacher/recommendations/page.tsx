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
import { Lightbulb, Sparkles, ListChecks, RefreshCw, AlertTriangle, Info } from "lucide-react";

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
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                {data.aiConfigured
                  ? `AI generation is enabled (${data.model}). Only anonymised academic facts are sent — never names, IDs, face or location data. Every recommendation cites the recorded facts it is based on.`
                  : "AI generation is not configured on this server, so recommendations come from the transparent rule engine and are labelled “Rule-based”."}
              </span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2 space-y-2">
                <CardTitle className="text-sm font-bold">Students by risk</CardTitle>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
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
                  <p className="text-xs text-slate-500 p-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading…
                  </p>
                ) : data.students.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4">No students in your classes.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.students.map((s) => (
                      <li key={s.studentId}>
                        <button
                          onClick={() => setSelected(s.studentId)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            current?.studentId === s.studentId ? "bg-indigo-50 border-indigo-200" : "border-transparent hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{s.name}</span>
                            <RiskBadge level={s.riskLevel} />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {s.studentId} • {s.className} • {s.recommendation ? s.recommendation.sourceLabel : "No recommendation yet"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                    {current ? `${current.name} (${current.studentId})` : "Select a student"}
                    {current && <RiskBadge level={current.riskLevel} />}
                  </CardTitle>
                  {current && (
                    <div className="flex gap-2">
                      {data?.aiConfigured && (
                        <Button size="sm" className="text-xs gap-1.5" disabled={generating !== null} onClick={() => generate("auto")}>
                          <Sparkles className="w-3.5 h-3.5" /> {generating === "auto" ? "Generating with AI…" : "Generate with AI"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-xs gap-1.5" disabled={generating !== null} onClick={() => generate("rule")}>
                        <ListChecks className="w-3.5 h-3.5" /> {generating === "rule" ? "Generating…" : "Generate rule-based"}
                      </Button>
                    </div>
                  )}
                </div>
                {current?.topReason && <p className="text-xs text-slate-500">Top risk reason: {current.topReason}</p>}
              </CardHeader>
              <CardContent>
                {genError && <p className="text-xs text-rose-700 mb-3">{genError}</p>}
                {generating === "auto" && (
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Asking the AI model — this can take up to a minute. It falls back to the rule engine if unavailable.
                  </p>
                )}
                {!current ? null : current.recommendation ? (
                  <RecommendationCard rec={current.recommendation} showReason />
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <Lightbulb className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">No recommendation yet</p>
                    <p className="text-xs text-slate-500">Generate one to get specific next steps for this student and for you.</p>
                  </div>
                )}
                {current?.recommendation && (
                  <p className="text-[11px] text-slate-400 mt-4">
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
