"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { TrendLine } from "@/components/charts/TrendLine";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { TrendBadge } from "@/components/engagement/TrendBadge";
import { ENGAGEMENT_ORDER, EngagementKey } from "@/components/engagement/ComponentBreakdown";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Activity, AlertTriangle, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";

interface InstitutionEngagement {
  summary: {
    studentCount: number;
    averageScore: number | null;
    distribution: { high: number; moderate: number; low: number; insufficientData: number };
    componentAverages: Record<EngagementKey, number | null>;
    improving: number;
    declining: number;
  };
  byClass: { classId: string; name: string; code: string; division: string; studentCount: number; averageScore: number | null }[];
  history: { date: string; averageScore: number | null }[];
  lowestEngaged: { studentId: string; name: string; className: string; score: number | null; trend?: string }[];
  classes: { id: string; name: string; code: string }[];
  methodology: { labels: Record<EngagementKey, string>; weights: Record<EngagementKey, number>; windowDays: number };
}

/** Institution-wide engagement analytics (admin). */
export function EngagementAnalytics() {
  const [classId, setClassId] = useState("");
  const [data, setData] = useState<InstitutionEngagement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    apiFetch<InstitutionEngagement>(`/admin/analytics/engagement${classId ? `?classId=${classId}` : ""}`).then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load engagement analytics.");
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
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Computing engagement analytics…
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
        <span className="text-[11px] text-slate-400">Window: last {data.methodology.windowDays} days</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Average engagement" value={s.averageScore === null ? "—" : `${s.averageScore} / 100`} icon={<Activity className="w-5 h-5" />} description={`${s.studentCount} active students`} />
        <StatsCard title="Low engagement (< 50)" value={s.distribution.low} iconBg="bg-rose-50 text-rose-600" icon={<AlertTriangle className="w-5 h-5" />} description={`${s.distribution.insufficientData} without enough data`} />
        <StatsCard title="Declining" value={s.declining} iconBg="bg-amber-50 text-amber-600" icon={<TrendingDown className="w-5 h-5" />} description="vs one week earlier" />
        <StatsCard title="Improving" value={s.improving} iconBg="bg-emerald-50 text-emerald-600" icon={<TrendingUp className="w-5 h-5" />} description="vs one week earlier" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Average engagement — weekly</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLine data={data.history.map((h) => ({ label: formatDate(h.date).replace(/, \d{4}$/, ""), value: h.averageScore }))} valueName="Average" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Average engagement by class</CardTitle>
          </CardHeader>
          <CardContent>
            <LabeledBars data={data.byClass.map((c) => ({ label: `${c.name} (${c.studentCount})`, value: c.averageScore }))} valueName="Average" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Average by component</CardTitle>
          </CardHeader>
          <CardContent>
            <LabeledBars
              data={ENGAGEMENT_ORDER.map((k) => ({ label: `${data.methodology.labels[k]} (${Math.round(data.methodology.weights[k] * 100)}%)`, value: s.componentAverages[k] }))}
              valueName="Average"
              height={200}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Lowest engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowestEngaged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-slate-500 py-6">
                      No scored students yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.lowestEngaged.map((st) => (
                    <TableRow key={st.studentId}>
                      <TableCell className="text-xs font-semibold text-slate-900">
                        {st.name} <span className="text-slate-400 font-mono font-normal">{st.studentId}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{st.className}</TableCell>
                      <TableCell className="text-xs font-bold">{st.score}</TableCell>
                      <TableCell>
                        <TrendBadge trend={st.trend || "NEW"} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
