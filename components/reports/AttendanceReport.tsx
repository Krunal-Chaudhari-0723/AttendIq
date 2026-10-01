"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { TrendLine } from "@/components/charts/TrendLine";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { ReportFilters, FilterState, defaultFilters, toQuery } from "./ReportFilters";
import { apiDownload, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { CalendarCheck, CheckCircle2, AlertTriangle, Users, RefreshCw, ShieldCheck } from "lucide-react";

interface Tally {
  present: number;
  late: number;
  absent: number;
  excused: number;
  counted: number;
  attendanceRate: number | null;
}

interface AttendanceReportData {
  range: { from: string; to: string };
  summary: Tally & { sessions: number; students: number };
  byDay: (Tally & { date: string })[];
  byClass: (Tally & { classId: string; name: string; sessions: number })[];
  bySubject: (Tally & { subjectId: string; name: string; className: string; sessions: number })[];
  byTeacher?: (Tally & { teacherId: string; name: string; sessions: number })[];
  byStudent: (Tally & { studentId: string; name: string; rollNumber: string; className: string })[];
  verificationMethods: Record<string, number>;
  filters: { classes: { id: string; name: string; division?: string }[]; subjects: { id: string; name: string; classId: string }[] };
}

const METHOD_LABELS: Record<string, string> = {
  FACE_AND_LOCATION: "Face + liveness + location",
  FACE_ONLY: "Face + liveness",
  REMOTE_FACE: "Remote face + liveness",
  MANUAL: "Manual / seeded",
  NOT_VERIFIED: "Absent (not verified)",
};

/** Attendance report for admin (`/admin/reports/attendance`) or teacher (`/teacher/reports/attendance`). */
export function AttendanceReport({ endpoint, showTeachers = false }: { endpoint: string; showTeachers?: boolean }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyBelow, setOnlyBelow] = useState(false);

  useEffect(() => {
    let ignore = false;
    apiFetch<AttendanceReportData>(`${endpoint}?${toQuery(filters)}`).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not build the report.");
    });
    return () => {
      ignore = true;
    };
  }, [endpoint, filters, reloadKey]);

  const exportCsv = async () => {
    setExporting(true);
    const r = await apiDownload(`${endpoint}?${toQuery(filters, { format: "csv" })}`, `attendance_${filters.from}_to_${filters.to}.csv`);
    setExporting(false);
    if (!r.success) setError(r.error || "Export failed.");
  };

  const s = data?.summary;
  const students = (data?.byStudent ?? []).filter((r) => !onlyBelow || (r.attendanceRate !== null && r.attendanceRate < 75));

  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={(f) => {
          setLoading(true);
          setFilters(f);
        }}
        classes={data?.filters.classes}
        subjects={data?.filters.subjects}
        loading={loading}
        onRefresh={() => {
          setLoading(true);
          setReloadKey((k) => k + 1);
        }}
        onExport={exportCsv}
        exporting={exporting}
      />
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {!data && loading && (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Building report…
        </div>
      )}
      {data && s && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Attendance rate" value={s.attendanceRate === null ? "—" : `${s.attendanceRate}%`} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-600" description={`${s.present + s.late} attended of ${s.counted} records`} />
            <StatsCard title="Sessions" value={s.sessions} icon={<CalendarCheck className="w-5 h-5" />} description={`${formatDate(data.range.from)} – ${formatDate(data.range.to)}`} />
            <StatsCard title="Late arrivals" value={s.late} iconBg="bg-amber-50 text-amber-600" icon={<AlertTriangle className="w-5 h-5" />} description={`${s.absent} absences • ${s.excused} excused`} />
            <StatsCard
              title="Below 75%"
              value={data.byStudent.filter((r) => r.attendanceRate !== null && r.attendanceRate < 75).length}
              iconBg="bg-rose-50 text-rose-600"
              icon={<Users className="w-5 h-5" />}
              description={`of ${s.students} students in this report`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Daily attendance rate</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendLine data={data.byDay.map((d) => ({ label: formatDate(d.date).replace(/, \d{4}$/, ""), value: d.attendanceRate }))} valueName="Attendance" suffix="%" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">By subject</CardTitle>
              </CardHeader>
              <CardContent>
                {data.bySubject.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No sessions in this period.</p>
                ) : (
                  <LabeledBars data={data.bySubject.map((x) => ({ label: x.name, value: x.attendanceRate }))} suffix="%" valueName="Attendance" />
                )}
              </CardContent>
            </Card>
            {data.byClass.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">By class</CardTitle>
                </CardHeader>
                <CardContent>
                  <LabeledBars data={data.byClass.map((x) => ({ label: `${x.name} (${x.sessions})`, value: x.attendanceRate }))} suffix="%" valueName="Attendance" />
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> How attendance was recorded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs">
                  {Object.entries(data.verificationMethods)
                    .sort(([, a], [, b]) => b - a)
                    .map(([m, n]) => (
                      <li key={m} className="flex justify-between">
                        <span className="text-slate-600">{METHOD_LABELS[m] ?? m}</span>
                        <span className="font-semibold text-slate-900">{n}</span>
                      </li>
                    ))}
                  {Object.keys(data.verificationMethods).length === 0 && <li className="text-slate-400">No records.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>

          {showTeachers && data.byTeacher && data.byTeacher.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Teacher / session statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead className="text-center">Sessions</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byTeacher.map((t) => (
                      <TableRow key={t.teacherId}>
                        <TableCell className="text-xs font-semibold">{t.name}</TableCell>
                        <TableCell className="text-center text-xs">{t.sessions}</TableCell>
                        <TableCell className="text-center text-xs">{t.present}</TableCell>
                        <TableCell className="text-center text-xs">{t.late}</TableCell>
                        <TableCell className="text-center text-xs">{t.absent}</TableCell>
                        <TableCell className="text-center text-xs font-bold">{t.attendanceRate === null ? "—" : `${t.attendanceRate}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">Student attendance ({students.length})</CardTitle>
              <label className="text-xs text-slate-600 flex items-center gap-2">
                <input type="checkbox" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} /> Only below 75%
              </label>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Excused</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-slate-500 py-6">
                        No students match.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((r) => (
                      <TableRow key={r.studentId}>
                        <TableCell className="text-xs font-semibold">
                          {r.name} <span className="font-mono font-normal text-slate-400">{r.studentId}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{r.className}</TableCell>
                        <TableCell className="text-center text-xs">{r.present}</TableCell>
                        <TableCell className="text-center text-xs">{r.late}</TableCell>
                        <TableCell className="text-center text-xs">{r.absent}</TableCell>
                        <TableCell className="text-center text-xs">{r.excused}</TableCell>
                        <TableCell className="text-center">
                          {r.attendanceRate === null ? (
                            "—"
                          ) : (
                            <Badge variant={r.attendanceRate >= 75 ? "success" : r.attendanceRate >= 60 ? "warning" : "danger"} size="sm">
                              {r.attendanceRate}%
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p className="text-[11px] text-slate-400 mt-2">Rate = (present + late) ÷ (present + late + absent). Exports contain no biometric or location data.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
