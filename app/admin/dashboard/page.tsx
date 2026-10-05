"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { BMU, BMUCrest } from "@/components/brand/BMUBrand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { TrendLine } from "@/components/charts/TrendLine";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { Users, GraduationCap, CheckCircle2, AlertTriangle, ArrowRight, Radio, RefreshCw, ShieldCheck, ScanFace, Activity } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";

interface AdminStats {
  kpis: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    faceEnrolled: number;
    todayAttendance: string;
    todayAttendanceNote: string;
    periodAttendance: number | null;
    activeSessionsCount: number;
    studentsAtRisk: number;
    overallEngagement: string;
  };
  activeSessions: { _id: string; subjectName: string; className: string; room?: string; mode: string; teacherName: string; endTime: string }[];
  riskDistribution: { low: number; medium: number; high: number; unknown: number };
  attendanceTrend: { date: string; rate: number | null; count: string }[];
  topAtRiskStudents: { id: string; name: string; class: string; attendance: string; risk: string; reason: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(
    () =>
      apiFetch<AdminStats>("/admin/stats").then((res) => {
        setIsLoading(false);
        if (res.success && res.data) {
          setData(res.data);
          setError(null);
        } else setError(res.error || "Could not load dashboard statistics.");
      }),
    []
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const dist = data?.riskDistribution;
  const assessed = dist ? dist.low + dist.medium + dist.high : 0;
  const share = (n: number) => (assessed ? Math.round((n / assessed) * 100) : 0);

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell title="Welcome Admin" subtitle="Institution overview: attendance, engagement and students who may need support" defaultRole="ADMIN">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 sm:px-5 py-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 min-w-0">
              <BMUCrest height={36} />
              <div className="min-w-0">
                <p className="eyebrow text-brand-600">BMU Academic Administration</p>
                <p className="text-sm font-semibold text-brand-950 truncate">{BMU.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 sm:text-right">
              {BMU.location}
              <span className="hidden sm:inline"> · Attendance &amp; engagement records</span>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {data && data.activeSessions.length > 0 && (
            <div className="rounded-xl bg-brand-900 text-white p-5 sm:p-6 border border-brand-800 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" />
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-white/10 text-white border border-white/15 shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold flex flex-wrap items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {data.activeSessions.length} live attendance session{data.activeSessions.length > 1 ? "s" : ""}
                    <Badge variant="success" size="sm">Live</Badge>
                  </h3>
                  <p className="text-xs text-brand-100/75 mt-1 leading-relaxed">
                    {data.activeSessions
                      .slice(0, 3)
                      .map((s) => `${s.subjectName} (${s.className}, ${s.teacherName}) until ${formatTime(s.endTime)}`)
                      .join(" • ")}
                  </p>
                </div>
              </div>
              <button onClick={fetchStats} className="self-start sm:self-center p-2 rounded-lg border border-white/20 bg-white/5 text-brand-100 hover:text-white hover:bg-white/10 transition-colors shrink-0" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}

          <section className="space-y-3">
            <p className="eyebrow">Key indicators</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatsCard title="Active Students" value={data ? data.kpis.totalStudents : "…"} description={data ? `${data.kpis.faceEnrolled} face-enrolled` : undefined} icon={<Users className="w-5 h-5" />} iconBg="bg-brand-50 text-brand-700" />
              <StatsCard title="Teachers" value={data ? data.kpis.totalTeachers : "…"} description={data ? `${data.kpis.totalClasses} classes • ${data.kpis.totalSubjects} subjects` : undefined} icon={<GraduationCap className="w-5 h-5" />} iconBg="bg-brand-50 text-brand-700" />
              <StatsCard title="Today's Attendance" value={data ? data.kpis.todayAttendance : "…"} description={data?.kpis.todayAttendanceNote} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-700" />
              <StatsCard title="Average Engagement" value={data ? data.kpis.overallEngagement : "…"} description="Last 30 days, weighted formula" icon={<Activity className="w-5 h-5" />} iconBg="bg-accent-50 text-accent-600" />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle>Attendance trend — last 14 days</CardTitle>
                  <CardDescription className="mt-1">
                    Daily rate across all sessions{data?.kpis.periodAttendance != null ? ` • period average ${data.kpis.periodAttendance}%` : ""}
                  </CardDescription>
                </div>
                <Link href="/admin/reports" className="shrink-0">
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    Reports <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {data ? (
                  <TrendLine data={data.attendanceTrend.map((d) => ({ label: formatDate(d.date).replace(/, \d{4}$/, ""), value: d.rate }))} valueName="Attendance" suffix="%" height={240} />
                ) : (
                  <div className="h-60 flex items-center justify-center text-xs text-slate-400">Loading…</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk distribution</CardTitle>
                <CardDescription>Explainable risk indicator, {assessed} students assessed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Low", n: dist?.low ?? 0, bar: "bg-emerald-600", text: "text-emerald-700" },
                  { label: "Medium", n: dist?.medium ?? 0, bar: "bg-amber-500", text: "text-amber-700" },
                  { label: "High", n: dist?.high ?? 0, bar: "bg-rose-600", text: "text-rose-700" },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className={r.text}>
                        {r.label} risk ({share(r.n)}%)
                      </span>
                      <span className="text-slate-600 tabular-nums">{r.n} students</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${share(r.n)}%` }} />
                    </div>
                  </div>
                ))}
                {dist && dist.unknown > 0 && <p className="text-[11px] text-slate-500">{dist.unknown} student(s) without enough data.</p>}
                <div className="flex gap-3 p-3 rounded-lg bg-brand-50/60 border border-brand-100 text-brand-900">
                  <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-snug">An indicator from attendance, quizzes, assignments and engagement — not a prediction.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Students who may need support
                </CardTitle>
                <CardDescription className="mt-1">Highest risk points first, with the main reason</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link href="/admin/face-enrollment">
                  <Button size="sm" variant="outline" className="text-xs gap-1">
                    <ScanFace className="w-3.5 h-3.5" /> Face enrollment
                  </Button>
                </Link>
                <Link href="/admin/students">
                  <Button size="sm" variant="outline" className="text-xs">
                    All students
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Main reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" /> Loading…
                      </TableCell>
                    </TableRow>
                  ) : data.topAtRiskStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState icon={CheckCircle2} title="No students are currently flagged medium or high risk." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.topAtRiskStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">{s.id}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-brand-950 whitespace-nowrap">{s.name}</TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">{s.class}</TableCell>
                        <TableCell className="text-xs font-semibold tabular-nums text-brand-950">{s.attendance}</TableCell>
                        <TableCell>
                          <RiskBadge level={s.risk} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 min-w-48">{s.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
