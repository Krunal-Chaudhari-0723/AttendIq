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
import { CheckCircle2, Activity, AlertTriangle, Lightbulb, Camera, ArrowRight, RefreshCw, ScanFace, Clock, FileText, Sparkles, ListChecks, GraduationCap, ShieldCheck, CalendarDays } from "lucide-react";
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

  const risk = data?.kpis.academicRisk;
  const riskIconBg =
    risk === "HIGH" ? "bg-rose-50 text-rose-700" : risk === "MEDIUM" ? "bg-amber-50 text-amber-700" : risk === "LOW" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700";
  const initials = (data?.student.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title={data ? `Welcome, ${data.student.name}` : "Welcome"} subtitle="Your attendance, engagement and next steps — all from your own records" defaultRole="STUDENT">
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {data && !data.student.isFaceEnrolled && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">Face enrollment required</h3>
                  <p className="text-xs text-amber-800 leading-relaxed">Enroll your face once so attendance can verify your identity. It takes about 10 seconds.</p>
                </div>
              </div>
              <Link href="/student/face-enrollment" className="shrink-0">
                <Button size="sm" className="text-xs gap-1.5 w-full sm:w-auto">
                  Enroll Now <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          )}

          {/* Student record + attendance window */}
          <section className="rounded-xl bg-brand-900 text-white p-5 sm:p-6 border border-brand-800 relative overflow-hidden">
            <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 text-white font-semibold text-lg flex items-center justify-center shrink-0">
                  {initials || <GraduationCap className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <p className="eyebrow text-accent-300">Student record</p>
                  <p className="text-lg font-semibold leading-snug truncate">{data ? data.student.name : "Loading…"}</p>
                  {data && (
                    <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-brand-100/75">
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" /> {data.student.className}
                      </span>
                      <span className="text-brand-100/40">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <ScanFace className="w-3.5 h-3.5" /> {data.student.isFaceEnrolled ? "Face enrolled" : "Face not enrolled"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-white/5 border border-white/10 p-4 lg:w-[26rem] lg:shrink-0">
                {data?.activeSession ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                          {!data.activeSession.alreadyMarked && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                          {data.activeSession.alreadyMarked ? "Attendance recorded" : "Attendance window open"}
                          <Badge variant={data.activeSession.alreadyMarked ? "success" : "warning"} size="sm">
                            {data.activeSession.alreadyMarked ? "DONE" : "ACTIVE NOW"}
                          </Badge>
                        </h3>
                        <p className="text-xs text-brand-100/75 mt-1 leading-relaxed">
                          {data.activeSession.subjectName} ({data.activeSession.className}) • {data.activeSession.mode} • closes {formatTime(data.activeSession.endTime)}
                        </p>
                      </div>
                    </div>
                    {!data.activeSession.alreadyMarked && (
                      <Link href="/student/live-attendance" className="shrink-0">
                        <Button variant="accent" className="text-xs w-full sm:w-auto">
                          Mark Attendance <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/10 text-brand-100 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">
                          {data?.nextSession ? `Next scheduled session: ${data.nextSession.subjectName}` : "No attendance session open right now"}
                        </h3>
                        <p className="text-xs text-brand-100/75 mt-0.5 leading-relaxed">
                          {data?.nextSession
                            ? `${formatDate(data.nextSession.startTime)} at ${formatTime(data.nextSession.startTime)} • ${data.nextSession.mode}`
                            : "When your teacher opens attendance, it will appear here."}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="text-xs gap-1.5 shrink-0 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30">
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="My Attendance" value={data ? data.kpis.attendancePercentage : "…"} description={data ? `${data.kpis.attendanceNote} • requirement 75%` : undefined} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-700" />
            <StatsCard title="Engagement" value={data ? data.kpis.overallScore : "…"} description="Last 30 days" icon={<Activity className="w-5 h-5" />} iconBg="bg-brand-50 text-brand-700" />
            <StatsCard
              title="Academic Standing"
              value={data ? (data.kpis.academicRisk === "HIGH" ? "Needs attention" : data.kpis.academicRisk === "MEDIUM" ? "Some concerns" : data.kpis.academicRisk === "LOW" ? "On track" : "Not enough data") : "…"}
              description="Risk indicator, not a prediction"
              icon={<ShieldCheck className="w-5 h-5" />}
              iconBg={riskIconBg}
            />
            <StatsCard title="Assignments Done" value={data ? data.kpis.assignmentsCompleted : "…"} description="Submitted of those due so far" icon={<FileText className="w-5 h-5" />} iconBg="bg-accent-50 text-accent-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Attendance by subject</CardTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">Marker shows the 75% requirement</p>
                </div>
                <Link href="/student/attendance">
                  <Button variant="ghost" size="sm" className="text-xs text-brand-700">
                    Details <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {!data ? (
                  <p className="text-xs text-slate-500">Loading…</p>
                ) : data.subjectAttendance.length === 0 ? (
                  <p className="text-xs text-slate-500">No subjects found for your class.</p>
                ) : (
                  data.subjectAttendance.map((s) => (
                    <div key={s.code}>
                      <div className="flex justify-between items-baseline gap-3 text-xs mb-1.5">
                        <span className="font-semibold text-brand-950 min-w-0">
                          {s.subject} <span className="text-slate-500 font-normal">({s.sessions} sessions)</span>
                        </span>
                        <span className={`font-semibold tabular-nums shrink-0 ${s.percentage === null ? "text-slate-400" : s.percentage >= 75 ? "text-emerald-700" : "text-rose-700"}`}>
                          {s.percentage === null ? "—" : `${s.percentage}%`} • {s.status}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className={`h-full rounded-full ${s.percentage !== null && s.percentage < 75 ? "bg-rose-500" : "bg-brand-600"}`} style={{ width: `${s.percentage ?? 0}%` }} />
                        <div className="absolute top-0 h-full w-0.5 bg-accent-500" style={{ left: "75%" }} title="75% requirement" />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle>Engagement</CardTitle>
                {data && <TrendBadge trend={data.engagement.trend} />}
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                {data &&
                  Object.entries(COMPONENT_LABELS).map(([k, label]) => {
                    const v = data.engagement.components[k];
                    return (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-32 text-slate-600 shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${v ?? 0}%` }} />
                        </div>
                        <span className="w-8 text-right font-semibold tabular-nums text-brand-950">{v ?? "—"}</span>
                      </div>
                    );
                  })}
                <Link href="/student/engagement" className="block pt-2 mt-auto">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    How my score is calculated
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" /> Standing
                </CardTitle>
                {data && <RiskBadge level={data.risk.riskLevel} />}
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {data?.risk.reasons.length ? (
                  data.risk.reasons.slice(0, 3).map((r) => (
                    <p key={r} className="text-slate-700 flex gap-2 leading-relaxed">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /> {r}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-500 flex gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> Nothing flagged right now.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-[3px] border-l-accent-500 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-accent-600" /> Recommended
                </CardTitle>
                {data?.recommendations && (
                  <Badge variant={data.recommendations.source === "AI" ? "accent" : "neutral"} size="sm" className="gap-1">
                    {data.recommendations.source === "AI" ? <Sparkles className="w-3 h-3" /> : <ListChecks className="w-3 h-3" />}
                    {data.recommendations.source === "AI" ? "AI-generated" : "Rule-based"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="text-xs space-y-3 flex-1 flex flex-col">
                {data?.recommendations?.items.length ? (
                  data.recommendations.items.map((i) => (
                    <div key={i.action} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0 mt-1.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-950">{i.action}</p>
                        <p className="text-slate-500 leading-relaxed">{i.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No recommendations yet.</p>
                )}
                <Link href="/student/recommendations" className="block pt-1 mt-auto">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View all
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-brand-600" /> Coming up & recent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-4">
                <div className="space-y-2">
                  <p className="eyebrow">Assignments</p>
                  {upcoming.length === 0 ? (
                    <p className="text-slate-500">No assignments due soon.</p>
                  ) : (
                    upcoming.map((a) => (
                      <p key={a.title} className="flex justify-between gap-2">
                        <span className="text-brand-950 font-medium truncate">{a.title}</span>
                        <span className="text-slate-500 shrink-0 tabular-nums">due {formatDate(a.dueDate)}</span>
                      </p>
                    ))
                  )}
                </div>
                {(data?.recentAttendance ?? []).length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="eyebrow">Recent attendance</p>
                    {(data?.recentAttendance ?? []).slice(0, 4).map((r) => (
                      <p key={r.id} className="flex justify-between items-center gap-2">
                        <span className="text-slate-700 truncate">
                          {r.subject} • {formatDate(r.date)}
                        </span>
                        <Badge variant={statusVariant(r.status)} size="sm">
                          {r.status}
                        </Badge>
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
