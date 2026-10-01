"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/ui/stats-card";
import { TrendLine } from "@/components/charts/TrendLine";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { ReportFilters, FilterState, defaultFilters, toQuery } from "@/components/reports/ReportFilters";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface Tally {
  present: number;
  late: number;
  absent: number;
  excused: number;
  counted: number;
  attendanceRate: number | null;
}

interface StudentReport {
  attendance: { summary: Tally & { sessions: number }; byDay: (Tally & { date: string })[]; bySubject: (Tally & { name: string; sessions: number })[] };
}

interface AttendanceRecordRow {
  _id: string;
  status: string;
  verificationMethod: string;
  confidence: number;
  markedAt: string;
  sessionId: { subjectName: string; mode: string; startTime: string } | null;
  verificationMetadata?: { distanceMeters?: number; note?: string };
}

const METHOD: Record<string, string> = {
  FACE_AND_LOCATION: "Face + liveness + location",
  FACE_ONLY: "Face + liveness",
  REMOTE_FACE: "Remote face + liveness",
  MANUAL: "Recorded by teacher",
  NOT_VERIFIED: "Not verified",
};
const statusVariant = (s: string) => (s === "PRESENT" ? "success" : s === "LATE" ? "warning" : s === "EXCUSED" ? "info" : "danger");

export default function StudentAttendancePage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [records, setRecords] = useState<AttendanceRecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiFetch<StudentReport>(`/student/reports?${toQuery(filters)}`).then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setReport(res.data);
        setError(null);
      } else setError(res.error || "Could not load your attendance report.");
    });
    return () => {
      ignore = true;
    };
  }, [filters, reloadKey]);

  useEffect(() => {
    apiFetch<{ records: AttendanceRecordRow[] }>("/student/attendance?limit=200").then((res) => {
      if (res.success && res.data) setRecords(res.data.records);
    });
  }, [reloadKey]);

  const s = report?.attendance.summary;
  const from = new Date(`${filters.from}T00:00:00`);
  const to = new Date(`${filters.to}T23:59:59`);
  const visible = (records ?? []).filter((r) => {
    const d = new Date(r.sessionId?.startTime ?? r.markedAt);
    return d >= from && d <= to;
  });

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title="My Attendance" subtitle="Your attendance by subject and day, and how each record was verified" defaultRole="STUDENT">
        <div className="space-y-6">
          <ReportFilters value={filters} onChange={setFilters} onRefresh={() => setReloadKey((k) => k + 1)} />
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
          {!report && !error && (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Loading…
            </div>
          )}
          {report && s && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Attendance rate" value={s.attendanceRate === null ? "—" : `${s.attendanceRate}%`} description={s.attendanceRate !== null && s.attendanceRate < 75 ? "Below the 75% requirement" : "Requirement: 75%"} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-600" />
                <StatsCard title="Present" value={s.present} icon={<CheckCircle2 className="w-5 h-5" />} description={`of ${s.counted} sessions`} />
                <StatsCard title="Late" value={s.late} icon={<Clock className="w-5 h-5" />} iconBg="bg-amber-50 text-amber-600" />
                <StatsCard title="Absent" value={s.absent} icon={<XCircle className="w-5 h-5" />} iconBg="bg-rose-50 text-rose-600" description={s.excused ? `${s.excused} excused` : undefined} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">By subject</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.attendance.bySubject.length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center">No sessions in this period.</p>
                    ) : (
                      <LabeledBars data={report.attendance.bySubject.map((x) => ({ label: `${x.name} (${x.sessions})`, value: x.attendanceRate }))} suffix="%" valueName="Attendance" />
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Day by day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendLine data={report.attendance.byDay.map((d) => ({ label: formatDate(d.date).replace(/, \d{4}$/, ""), value: d.attendanceRate }))} suffix="%" valueName="Attendance" />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Attendance log ({visible.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>How it was recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!records ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-6">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-6">
                        No attendance records in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell className="text-xs">
                          {formatDate(r.sessionId?.startTime ?? r.markedAt)}
                          <span className="block text-slate-400">{formatTime(r.markedAt)}</span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{r.sessionId?.subjectName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.sessionId?.mode ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(r.status)} size="sm">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-600">
                          {METHOD[r.verificationMethod] ?? r.verificationMethod}
                          {r.confidence > 0 && <span className="block text-slate-400">face similarity {Math.round(r.confidence * 100)}%{r.verificationMetadata?.distanceMeters != null ? ` • ${r.verificationMetadata.distanceMeters} m from campus` : ""}</span>}
                        </TableCell>
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
