"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { TrendLine } from "@/components/charts/TrendLine";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { TrendBadge } from "@/components/engagement/TrendBadge";
import { ENGAGEMENT_ORDER, EngagementKey } from "@/components/engagement/ComponentBreakdown";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Activity, Users, TrendingDown, TrendingUp, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Row {
  studentId: string;
  name: string;
  rollNumber: string;
  className: string;
  overallScore: number | null;
  components: Record<EngagementKey, number | null>;
  coverage: number;
  trend: string;
  previousScore: number | null;
  explanation: string[];
}

interface ClassEngagement {
  summary: {
    studentCount: number;
    averageScore: number | null;
    distribution: { high: number; moderate: number; low: number; insufficientData: number };
    componentAverages: Record<EngagementKey, number | null>;
    improving: number;
    declining: number;
  };
  history: { date: string; averageScore: number | null }[];
  students: Row[];
  filters: {
    classes: { id: string; name: string; code: string; division: string }[];
    subjects: { id: string; name: string; code: string; classId: string }[];
  };
  methodology: { labels: Record<EngagementKey, string>; weights: Record<EngagementKey, number>; windowDays: number };
}

const SHORT: Record<EngagementKey, string> = {
  attendance: "Att.",
  quiz: "Quiz",
  assignments: "Assign.",
  participation: "Partic.",
  learningActivity: "Learn.",
};

const scoreColor = (s: number | null) =>
  s === null ? "text-slate-400" : s >= 75 ? "text-emerald-700" : s >= 50 ? "text-amber-700" : "text-rose-700";

export default function TeacherEngagementPage() {
  const [data, setData] = useState<ClassEngagement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [band, setBand] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (subjectId) params.set("subjectId", subjectId);
    apiFetch<ClassEngagement>(`/teacher/engagement?${params}`).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load engagement.");
    });
    return () => {
      ignore = true;
    };
  }, [classId, subjectId, reloadKey]);

  const subjectOptions = useMemo(
    () => (data?.filters.subjects ?? []).filter((s) => !classId || s.classId === classId),
    [data, classId]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.students ?? [])
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.studentId.toLowerCase().includes(q))
      .filter((r) => {
        if (!band) return true;
        if (band === "LOW") return r.overallScore !== null && r.overallScore < 50;
        if (band === "MODERATE") return r.overallScore !== null && r.overallScore >= 50 && r.overallScore < 75;
        if (band === "HIGH") return r.overallScore !== null && r.overallScore >= 75;
        if (band === "DECLINING") return r.trend === "DOWN";
        return true;
      })
      .sort((a, b) => (a.overallScore ?? 101) - (b.overallScore ?? 101));
  }, [data, search, band]);

  const s = data?.summary;

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Class Engagement" subtitle="Weighted engagement of your students, computed from real academic records" defaultRole="TEACHER">
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classId}
              onChange={(e) => {
                setLoading(true);
                setClassId(e.target.value);
                setSubjectId("");
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
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
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
            >
              <option value="">All subjects</option>
              {subjectOptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
            <select value={band} onChange={(e) => setBand(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700">
              <option value="">All engagement levels</option>
              <option value="LOW">Low (&lt; 50)</option>
              <option value="MODERATE">Moderate (50–74)</option>
              <option value="HIGH">High (75+)</option>
              <option value="DECLINING">Declining trend</option>
            </select>
            <div className="w-56">
              <Input icon={<Search className="w-4 h-4" />} placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-xs" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs ml-auto gap-1.5"
              onClick={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {!data && loading && (
            <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Computing engagement…
            </div>
          )}

          {data && s && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Average engagement" value={s.averageScore === null ? "—" : `${s.averageScore} / 100`} icon={<Activity className="w-5 h-5" />} description={`${s.studentCount} students • last ${data.methodology.windowDays} days`} />
                <StatsCard title="Low engagement (< 50)" value={s.distribution.low} iconBg="bg-rose-50 text-rose-600" icon={<AlertTriangle className="w-5 h-5" />} description={`${s.distribution.moderate} moderate • ${s.distribution.high} high`} />
                <StatsCard title="Declining this week" value={s.declining} iconBg="bg-amber-50 text-amber-600" icon={<TrendingDown className="w-5 h-5" />} description="Dropped 3+ points vs last week" />
                <StatsCard title="Improving this week" value={s.improving} iconBg="bg-emerald-50 text-emerald-600" icon={<TrendingUp className="w-5 h-5" />} description="Rose 3+ points vs last week" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Class average engagement — weekly</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendLine data={data.history.map((h) => ({ label: formatDate(h.date).replace(/, \d{4}$/, ""), value: h.averageScore }))} valueName="Class average" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Average by component</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabeledBars
                      data={ENGAGEMENT_ORDER.map((k) => ({
                        label: `${data.methodology.labels[k]} (${Math.round(data.methodology.weights[k] * 100)}%)`,
                        value: s.componentAverages[k],
                      }))}
                      valueName="Class average"
                      height={200}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" /> Students ({rows.length}) — lowest engagement first
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6" />
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Trend</TableHead>
                        {ENGAGEMENT_ORDER.map((k) => (
                          <TableHead key={k} className="text-center">
                            {SHORT[k]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-xs text-slate-500">
                            No students match these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((r) => (
                          <React.Fragment key={r.studentId}>
                            <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === r.studentId ? null : r.studentId)}>
                              <TableCell className="text-slate-400">
                                {expanded === r.studentId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </TableCell>
                              <TableCell>
                                <p className="text-xs font-semibold text-slate-900">{r.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{r.studentId}</p>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">{r.className}</TableCell>
                              <TableCell className={`text-sm font-bold ${scoreColor(r.overallScore)}`}>{r.overallScore ?? "—"}</TableCell>
                              <TableCell>
                                <TrendBadge trend={r.trend} delta={r.overallScore !== null && r.previousScore !== null ? r.overallScore - r.previousScore : null} />
                              </TableCell>
                              {ENGAGEMENT_ORDER.map((k) => (
                                <TableCell key={k} className={`text-center text-xs font-semibold ${scoreColor(r.components[k])}`}>
                                  {r.components[k] ?? "—"}
                                </TableCell>
                              ))}
                            </TableRow>
                            {expanded === r.studentId && (
                              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                                <TableCell />
                                <TableCell colSpan={9}>
                                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                                    {r.explanation.map((line) => (
                                      <li key={line}>{line}</li>
                                    ))}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <p className="text-[11px] text-slate-400 mt-2">
                    “—” means no data for that component in the window; its weight is redistributed instead of being guessed.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
