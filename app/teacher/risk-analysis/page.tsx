"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { RiskBadge, RiskDirection } from "@/components/risk/RiskBadge";
import { StudentInsightsModal } from "@/components/risk/StudentInsightsModal";
import { apiFetch } from "@/lib/api";
import { AlertOctagon, AlertTriangle, CheckCircle2, ArrowUpRight, RefreshCw, Info, Lightbulb, Filter, Scale } from "lucide-react";
import Link from "next/link";

interface RiskRow {
  studentId: string;
  name: string;
  rollNumber: string;
  className: string;
  risk: {
    level: string;
    points: number;
    factors: { code: string; points: number; message: string }[];
    strengths: string[];
    direction: string;
    signals: { attendanceRate: number | null; quizAverage: number | null; assignmentCompletionRate: number | null; engagementScore: number | null };
  };
}

interface RiskData {
  summary: { high: number; medium: number; low: number; unknown: number; rising: number };
  students: RiskRow[];
  filters: { classes: { id: string; name: string; division: string }[]; subjects: { id: string; name: string; classId: string }[] };
  methodology: { disclaimer: string; levels: Record<string, string>; rules: string[] };
}

const SELECT_CLS =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export default function TeacherRiskAnalysisPage() {
  const [data, setData] = useState<RiskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (subjectId) params.set("subjectId", subjectId);
    apiFetch<RiskData>(`/teacher/risk-analysis?${params}`).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load risk analysis.");
    });
    return () => {
      ignore = true;
    };
  }, [classId, subjectId, reloadKey]);

  const rows = useMemo(() => (data?.students ?? []).filter((r) => !level || r.risk.level === level), [data, level]);
  const subjectOptions = (data?.filters.subjects ?? []).filter((s) => !classId || s.classId === classId);

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Academic Risk Indicator" subtitle="Explainable early-warning flags for students who may need support" defaultRole="TEACHER">
        <div className="space-y-6">
          <div className="flex gap-3 p-4 rounded-lg bg-brand-50/60 border border-brand-100 text-xs text-brand-900">
            <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {data?.methodology.disclaimer ?? "This is a risk indicator, not a prediction."} Every flag lists the rules that triggered it; click a
              student for details.
            </span>
          </div>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                <span className="eyebrow flex items-center gap-1.5 shrink-0">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </span>
                <select
                  value={classId}
                  onChange={(e) => {
                    setLoading(true);
                    setClassId(e.target.value);
                    setSubjectId("");
                  }}
                  className={`${SELECT_CLS} w-full sm:w-auto`}
                >
                  <option value="">All my classes</option>
                  {data?.filters.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.division})
                    </option>
                  ))}
                </select>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setLoading(true);
                    setSubjectId(e.target.value);
                  }}
                  className={`${SELECT_CLS} w-full sm:w-auto`}
                >
                  <option value="">All subjects</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${SELECT_CLS} w-full sm:w-auto`}>
                  <option value="">All risk levels</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="UNKNOWN">Not enough data</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start sm:self-auto sm:ml-auto"
                  onClick={() => {
                    setLoading(true);
                    setReloadKey((k) => k + 1);
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {!data && loading && (
            <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" /> Evaluating risk rules…
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatsCard title="High risk" value={data.summary.high} iconBg="bg-rose-50 text-rose-700" icon={<AlertOctagon className="w-5 h-5" />} description={data.methodology.levels.HIGH} />
                <StatsCard title="Medium risk" value={data.summary.medium} iconBg="bg-amber-50 text-amber-700" icon={<AlertTriangle className="w-5 h-5" />} description={data.methodology.levels.MEDIUM} />
                <StatsCard title="Low risk" value={data.summary.low} iconBg="bg-emerald-50 text-emerald-700" icon={<CheckCircle2 className="w-5 h-5" />} description={data.methodology.levels.LOW} />
                <StatsCard title="Risk rising" value={data.summary.rising} iconBg="bg-brand-50 text-brand-700" icon={<ArrowUpRight className="w-5 h-5" />} description="More risk points than a week ago" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
                <Card className="xl:col-span-3 min-w-0">
                  <CardHeader>
                    <CardTitle>Students ({rows.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Trend</TableHead>
                          <TableHead>Main reasons</TableHead>
                          <TableHead className="text-center">Att.</TableHead>
                          <TableHead className="text-center">Quiz</TableHead>
                          <TableHead className="text-center">Assign.</TableHead>
                          <TableHead className="text-center">Engage.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-500">
                              No students match these filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((r) => (
                            <TableRow key={r.studentId} className="cursor-pointer" onClick={() => setSelected(r.studentId)}>
                              <TableCell>
                                <p className="text-sm font-semibold text-brand-950 whitespace-nowrap">{r.name}</p>
                                <p className="text-[11px] text-slate-500 whitespace-nowrap">
                                  <span className="tabular-nums">{r.studentId}</span> • {r.className}
                                </p>
                              </TableCell>
                              <TableCell>
                                <RiskBadge level={r.risk.level} />
                              </TableCell>
                              <TableCell>
                                <RiskDirection direction={r.risk.direction} />
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 min-w-56 max-w-sm leading-snug">
                                {r.risk.factors.length === 0 ? (
                                  <span className="text-slate-500">No risk rules triggered</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {r.risk.factors.slice(0, 2).map((f) => (
                                      <li key={f.code}>• {f.message}</li>
                                    ))}
                                    {r.risk.factors.length > 2 && <li className="text-slate-500 font-medium">+{r.risk.factors.length - 2} more</li>}
                                  </ul>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-xs tabular-nums font-semibold text-brand-950">{pct(r.risk.signals.attendanceRate)}</TableCell>
                              <TableCell className="text-center text-xs tabular-nums font-semibold text-brand-950">{pct(r.risk.signals.quizAverage)}</TableCell>
                              <TableCell className="text-center text-xs tabular-nums font-semibold text-brand-950">{pct(r.risk.signals.assignmentCompletionRate)}</TableCell>
                              <TableCell className="text-center text-xs tabular-nums font-semibold text-brand-950">{r.risk.signals.engagementScore ?? "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="min-w-0">
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                    <Scale className="w-4 h-4 text-brand-600" />
                    <CardTitle>How risk is scored</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-xs text-slate-600 leading-relaxed list-disc pl-4 marker:text-brand-400">
                      {data.methodology.rules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-600 pt-3 border-t border-slate-100 leading-relaxed">
                      High: {data.methodology.levels.HIGH} • Medium: {data.methodology.levels.MEDIUM} • Low: {data.methodology.levels.LOW}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <StudentInsightsModal
          studentId={selected}
          onClose={() => setSelected(null)}
          footer={(ins) => (
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Link href={`/teacher/recommendations?studentId=${ins.student.studentId}`}>
                <Button size="sm">
                  <Lightbulb className="w-3.5 h-3.5" /> View recommendations
                </Button>
              </Link>
            </div>
          )}
        />
      </AppShell>
    </ProtectedRoute>
  );
}
