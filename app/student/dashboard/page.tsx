"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { TrendBadge } from "@/components/engagement/TrendBadge";
import { CheckCircle2, Activity, AlertTriangle, Lightbulb, Camera, ArrowRight, RefreshCw, ScanFace, Clock, FileText, Sparkles, ListChecks } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";

interface StudentDashboardData {
  student: { id: string; name: string; className: string; isFaceEnrolled: boolean };
  kpis: { attendancePercentage: string; attendanceNote: string; overallScore: string; academicRisk: string; assignmentsCompleted: string };
  activeSession: { id: string; subjectName: string; className: string; mode: string; room: string; endTime: string; alreadyMarked: boolean } | null;
  nextSession: { subjectName: string; startTime: string; mode: string } | null;
  subjectAttendance: { subject: string; code: string; sessions: number; percentage: number | null; status: string }[];
  recentAttendance: { id: string; subject: string; date: string; status: string; verificationMethod: string }[];
  engagement: { overallScore: number | null; components: Record<string, number | null>; trend: string };
  risk: { riskLevel: string; reasons: string[]; strengths: string[] };
  recommendations: { summary: string; priority: string; source: "AI" | "RULE_BASED"; items: { action: string; description: string }[] } | null;
  assignments: { title: string; subject: string; status: string; dueDate: string }[];
}

const COMPONENT_LABELS: Record<string, string> = {
  attendance: "Attendance (30%)",
  quiz: "Quizzes (25%)",
  assignments: "Assignments (20%)",
  participation: "Participation (15%)",
  learningActivity: "Learning (10%)",
};

const statusVariant = (s: string) => (s === "PRESENT" ? "success" : s === "LATE" ? "warning" : s === "EXCUSED" ? "info" : "danger");

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    () =>
      apiFetch<StudentDashboardData>("/student/dashboard").then((res) => {
        setIsLoading(false);
        if (res.success && res.data) {
          setData(res.data);
          setError(null);
        } else setError(res.error || "Could not load your dashboard.");
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = (data?.assignments ?? []).filter((a) => a.status === "PENDING" && new Date(a.dueDate) >= new Date()).slice(0, 3);

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title={data ? `Welcome, ${data.student.name}` : "Welcome"} subtitle="Your attendance, engagement and next steps — all from your own records" defaultRole="STUDENT">
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {data && !data.student.isFaceEnrolled && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Face enrollment required</h3>
                  <p className="text-xs text-amber-800">Enroll your face once so attendance can verify your identity. It takes about 10 seconds.</p>
                </div>
              </div>
              <Link href="/student/face-enrollment">
                <Button size="sm" className="text-xs gap-1.5">
                  Enroll Now <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          )}

          {data?.activeSession ? (
            <div className="p-4 rounded-xl bg-indigo-700 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/10">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    {data.activeSession.alreadyMarked ? "Attendance recorded" : "Attendance window open"}
                    <Badge variant={data.activeSession.alreadyMarked ? "success" : "warning"} size="sm">
                      {data.activeSession.alreadyMarked ? "DONE" : "ACTIVE NOW"}
                    </Badge>
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    {data.activeSession.subjectName} ({data.activeSession.className}) • {data.activeSession.mode} • closes {formatTime(data.activeSession.endTime)}
                  </p>
                </div>
              </div>
              {!data.activeSession.alreadyMarked && (
                <Link href="/student/live-attendance">
                  <Button variant="outline" className="bg-white text-indigo-700 hover:bg-indigo-50 border-none font-bold text-xs">
                    Mark Attendance <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {data?.nextSession ? `Next scheduled session: ${data.nextSession.subjectName}` : "No attendance session open right now"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {data?.nextSession
                      ? `${formatDate(data.nextSession.startTime)} at ${formatTime(data.nextSession.startTime)} • ${data.nextSession.mode}`
                      : "When your teacher opens attendance, it will appear here."}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={load} className="text-xs border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="My Attendance" value={data ? data.kpis.attendancePercentage : "…"} description={data ? `${data.kpis.attendanceNote} • requirement 75%` : undefined} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-600" />
            <StatsCard title="Engagement" value={data ? data.kpis.overallScore : "…"} description="Last 30 days" icon={<Activity className="w-5 h-5" />} iconBg="bg-indigo-50 text-indigo-600" />
            <StatsCard
              title="Academic Standing"
              value={data ? (data.kpis.academicRisk === "HIGH" ? "Needs attention" : data.kpis.academicRisk === "MEDIUM" ? "Some concerns" : data.kpis.academicRisk === "LOW" ? "On track" : "Not enough data") : "…"}
              description="Risk indicator, not a prediction"
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
            <StatsCard title="Assignments Done" value={data ? data.kpis.assignmentsCompleted : "…"} description="Submitted of those due so far" icon={<FileText className="w-5 h-5" />} iconBg="bg-blue-50 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold">Attendance by subject</CardTitle>
                <Link href="/student/attendance">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Details <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {!data ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : data.subjectAttendance.length === 0 ? (
                  <p className="text-xs text-slate-400">No subjects found for your class.</p>
                ) : (
                  data.subjectAttendance.map((s) => (
                    <div key={s.code}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800">
                          {s.subject} <span className="text-slate-400 font-normal">({s.sessions} sessions)</span>
                        </span>
                        <span className={`font-bold ${s.percentage === null ? "text-slate-400" : s.percentage >= 75 ? "text-emerald-700" : "text-rose-700"}`}>
                          {s.percentage === null ? "—" : `${s.percentage}%`} • {s.status}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className={`h-full rounded-full ${s.percentage !== null && s.percentage < 75 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${s.percentage ?? 0}%` }} />
                        <div className="absolute top-0 h-full w-px bg-slate-400" style={{ left: "75%" }} title="75% requirement" />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold">Engagement</CardTitle>
                {data && <TrendBadge trend={data.engagement.trend} />}
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data &&
                  Object.entries(COMPONENT_LABELS).map(([k, label]) => {
                    const v = data.engagement.components[k];
                    return (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-32 text-slate-600 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600" style={{ width: `${v ?? 0}%` }} />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-800">{v ?? "—"}</span>
                      </div>
                    );
                  })}
                <Link href="/student/engagement" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    How my score is calculated
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold">Standing</CardTitle>
                {data && <RiskBadge level={data.risk.riskLevel} />}
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                {data?.risk.reasons.length ? (
                  data.risk.reasons.slice(0, 3).map((r) => (
                    <p key={r} className="text-slate-700 flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /> {r}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-500">Nothing flagged right now.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600" /> Recommended
                </CardTitle>
                {data?.recommendations && (
                  <Badge variant={data.recommendations.source === "AI" ? "purple" : "neutral"} size="sm" className="gap-1">
                    {data.recommendations.source === "AI" ? <Sparkles className="w-3 h-3" /> : <ListChecks className="w-3 h-3" />}
                    {data.recommendations.source === "AI" ? "AI-generated" : "Rule-based"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {data?.recommendations?.items.length ? (
                  data.recommendations.items.map((i) => (
                    <div key={i.action}>
                      <p className="font-semibold text-slate-800">{i.action}</p>
                      <p className="text-slate-500">{i.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No recommendations yet.</p>
                )}
                <Link href="/student/recommendations" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View all
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Coming up & recent</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div className="space-y-1.5">
                  {upcoming.length === 0 ? (
                    <p className="text-slate-500">No assignments due soon.</p>
                  ) : (
                    upcoming.map((a) => (
                      <p key={a.title} className="flex justify-between gap-2">
                        <span className="text-slate-800 truncate">{a.title}</span>
                        <span className="text-slate-400 shrink-0">due {formatDate(a.dueDate)}</span>
                      </p>
                    ))
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {(data?.recentAttendance ?? []).slice(0, 4).map((r) => (
                    <p key={r.id} className="flex justify-between gap-2">
                      <span className="text-slate-700 truncate">
                        {r.subject} • {formatDate(r.date)}
                      </span>
                      <Badge variant={statusVariant(r.status)} size="sm">
                        {r.status}
                      </Badge>
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
