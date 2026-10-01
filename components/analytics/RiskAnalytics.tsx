"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { RiskBadge, RiskDirection } from "@/components/risk/RiskBadge";
import { apiFetch } from "@/lib/api";
import { AlertOctagon, AlertTriangle, CheckCircle2, ArrowUpRight, RefreshCw } from "lucide-react";

interface InstitutionRisk {
  summary: { studentCount: number; high: number; medium: number; low: number; unknown: number; rising: number };
  byClass: { classId: string; name: string; code: string; studentCount: number; high: number; medium: number; low: number }[];
  topFactors: { code: string; count: number }[];
  atRisk: { studentId: string; name: string; className: string; risk: { level: string; points: number; direction: string; factors: { message: string }[] } }[];
  classes: { id: string; name: string }[];
  methodology: { disclaimer: string };
}

const FACTOR_LABELS: Record<string, string> = {
  ATTENDANCE_CRITICAL: "Attendance < 60%",
  ATTENDANCE_LOW: "Attendance < 75%",
  ATTENDANCE_DECLINING: "Attendance declining",
  QUIZ_FAILING: "Quiz avg < 50%",
  QUIZ_LOW: "Quiz avg < 60%",
  ASSIGNMENTS_POOR: "Assignments < 60% done",
  ASSIGNMENTS_LOW: "Assignments < 80% done",
  ENGAGEMENT_VERY_LOW: "Engagement < 50",
  ENGAGEMENT_LOW: "Engagement < 65",
  ENGAGEMENT_DECLINING: "Engagement declining",
  PARTICIPATION_LOW: "Low participation",
};

/** Institution-wide risk analytics (admin). */
export function RiskAnalytics() {
  const [classId, setClassId] = useState("");
  const [data, setData] = useState<InstitutionRisk | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    apiFetch<InstitutionRisk>(`/admin/analytics/risk${classId ? `?classId=${classId}` : ""}`).then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load risk analytics.");
    });
    return () => {
      ignore = true;
    };
  }, [classId]);

  if (error)
    return (
      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  if (!data)
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Evaluating risk indicators…
      </div>
    );

  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700">
          <option value="">All classes</option>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400">{data.methodology.disclaimer}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="High risk" value={s.high} iconBg="bg-rose-50 text-rose-600" icon={<AlertOctagon className="w-5 h-5" />} description={`of ${s.studentCount} students`} />
        <StatsCard title="Medium risk" value={s.medium} iconBg="bg-amber-50 text-amber-600" icon={<AlertTriangle className="w-5 h-5" />} />
        <StatsCard title="Low risk" value={s.low} iconBg="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 className="w-5 h-5" />} description={`${s.unknown} without enough data`} />
        <StatsCard title="Risk rising" value={s.rising} iconBg="bg-indigo-50 text-indigo-600" icon={<ArrowUpRight className="w-5 h-5" />} description="vs one week earlier" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Most common risk reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topFactors.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No risk rules triggered.</p>
            ) : (
              <LabeledBars
                data={data.topFactors.map((f) => ({ label: FACTOR_LABELS[f.code] || f.code, value: f.count }))}
                max={Math.max(...data.topFactors.map((f) => f.count))}
                suffix=" students"
                valueName="Students"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Risk by class</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-center">High</TableHead>
                  <TableHead className="text-center">Medium</TableHead>
                  <TableHead className="text-center">Low</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byClass.map((c) => (
                  <TableRow key={c.classId}>
                    <TableCell className="text-xs font-semibold">{c.name}</TableCell>
                    <TableCell className="text-center text-xs">{c.studentCount}</TableCell>
                    <TableCell className="text-center text-xs font-bold text-rose-700">{c.high}</TableCell>
                    <TableCell className="text-center text-xs font-bold text-amber-700">{c.medium}</TableCell>
                    <TableCell className="text-center text-xs font-bold text-emerald-700">{c.low}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Students flagged medium or high ({data.atRisk.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Top reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.atRisk.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-6">
                    No students are currently flagged.
                  </TableCell>
                </TableRow>
              ) : (
                data.atRisk.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell className="text-xs font-semibold">
                      {r.name} <span className="font-mono font-normal text-slate-400">{r.studentId}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{r.className}</TableCell>
                    <TableCell>
                      <RiskBadge level={r.risk.level} />
                    </TableCell>
                    <TableCell>
                      <RiskDirection direction={r.risk.direction} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{r.risk.factors[0]?.message}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
