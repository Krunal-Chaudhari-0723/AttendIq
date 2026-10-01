"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { ReportFilters, FilterState, defaultFilters, toQuery } from "./ReportFilters";
import { apiDownload, apiFetch } from "@/lib/api";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface PerfRow {
  quizCount: number;
  quizAverage: number | null;
  assignmentsDue: number;
  assignmentsSubmitted: number;
  completionRate: number | null;
  gradeAverage: number | null;
}

interface PerformanceData {
  bySubject: (PerfRow & { subject: string })[];
  byStudent: (PerfRow & { studentId: string; name: string; className: string })[];
  filters?: { classes: { id: string; name: string; division?: string }[]; subjects: { id: string; name: string; classId: string }[] };
}

const fmt = (v: number | null) => (v === null ? "—" : `${v}%`);

/** Quiz & assignment performance report (admin or teacher scope). */
export function PerformanceReport({ endpoint, classes }: { endpoint: string; classes?: { id: string; name: string }[] }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiFetch<PerformanceData>(`${endpoint}?${toQuery(filters)}`).then((res) => {
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
    const r = await apiDownload(`${endpoint}?${toQuery(filters, { format: "csv" })}`, `performance_${filters.from}_to_${filters.to}.csv`);
    setExporting(false);
    if (!r.success) setError(r.error || "Export failed.");
  };

  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={(f) => {
          setLoading(true);
          setFilters(f);
        }}
        classes={data?.filters?.classes ?? classes}
        subjects={data?.filters?.subjects}
        showSubject={Boolean(data?.filters)}
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
      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Quiz average by subject</CardTitle>
              </CardHeader>
              <CardContent>
                {data.bySubject.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No quiz or assignment data in this period.</p>
                ) : (
                  <LabeledBars data={data.bySubject.map((s) => ({ label: s.subject, value: s.quizAverage }))} suffix="%" valueName="Quiz average" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Assignment completion by subject</CardTitle>
              </CardHeader>
              <CardContent>
                {data.bySubject.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No data.</p>
                ) : (
                  <LabeledBars data={data.bySubject.map((s) => ({ label: s.subject, value: s.completionRate }))} suffix="%" valueName="Completion" />
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Students — lowest quiz average first</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-center">Quizzes</TableHead>
                    <TableHead className="text-center">Quiz avg</TableHead>
                    <TableHead className="text-center">Assignments</TableHead>
                    <TableHead className="text-center">Completion</TableHead>
                    <TableHead className="text-center">Grade avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byStudent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-slate-500 py-6">
                        No students.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byStudent.map((r) => (
                      <TableRow key={r.studentId}>
                        <TableCell className="text-xs font-semibold">
                          {r.name} <span className="font-mono font-normal text-slate-400">{r.studentId}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{r.className}</TableCell>
                        <TableCell className="text-center text-xs">{r.quizCount}</TableCell>
                        <TableCell className="text-center text-xs font-semibold">{fmt(r.quizAverage)}</TableCell>
                        <TableCell className="text-center text-xs">
                          {r.assignmentsSubmitted}/{r.assignmentsDue}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold">{fmt(r.completionRate)}</TableCell>
                        <TableCell className="text-center text-xs font-semibold">{fmt(r.gradeAverage)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
