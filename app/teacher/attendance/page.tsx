"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { CalendarCheck, RefreshCw, AlertTriangle, Radio } from "lucide-react";

interface SessionRow {
  id: string;
  subjectName: string;
  className: string;
  division?: string;
  mode: string;
  status: string;
  startTime: string;
  endTime: string;
  room?: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number | null;
}

const statusVariant = (s: string) => (s === "ACTIVE" ? "success" : s === "SCHEDULED" ? "brand" : s === "CANCELLED" ? "neutral" : "info");

export default function TeacherAttendancePage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    apiFetch<{ sessions: SessionRow[] }>("/teacher/attendance?limit=60").then((res) => {
      if (res.success && res.data) {
        setSessions(res.data.sessions);
        setError(null);
      } else setError(res.error || "Could not load sessions.");
    });
  }, [reloadKey]);

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Attendance History" subtitle="Every session you have run, with real attendance counts" defaultRole="TEACHER">
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-brand-600" /> Sessions
              </CardTitle>
              <div className="flex gap-2">
                <Link href="/teacher/live-attendance">
                  <Button size="sm">
                    <Radio className="w-3.5 h-3.5" /> Live Attendance
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!sessions ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-left sm:text-center py-10 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" /> Loading sessions…
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-left sm:text-center py-10 text-xs text-slate-500">
                        No sessions yet. Start one from Live Attendance.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs whitespace-nowrap tabular-nums font-medium text-slate-800">
                          {formatDate(s.startTime)}
                          <span className="block text-[11px] font-normal text-slate-500">{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-brand-950">{s.subjectName}</TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">{s.className}{s.division ? ` (${s.division})` : ""}</TableCell>
                        <TableCell><Badge variant="neutral" size="sm">{s.mode}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(s.status)} size="sm">{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums font-semibold text-emerald-700">{s.present}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums font-semibold text-amber-700">{s.late}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums font-semibold text-rose-700">{s.absent}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums font-semibold text-brand-950">{s.attendanceRate === null ? "—" : `${s.attendanceRate}%`}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p className="text-[11px] text-slate-500 mt-3">Rate = (present + late) ÷ (present + late + absent). Excused records are excluded.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
