"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { TrendLine } from "@/components/charts/TrendLine";
import { ComponentBreakdown, EngagementComponent, EngagementKey } from "@/components/engagement/ComponentBreakdown";
import { TrendBadge } from "@/components/engagement/TrendBadge";
import { RiskBadge, RiskDirection } from "@/components/risk/RiskBadge";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface Insights {
  student: { studentId: string; name: string; rollNumber: string; className: string; email: string };
  engagement: {
    overallScore: number | null;
    components: Record<EngagementKey, EngagementComponent>;
    explanation: string[];
    trend: { trend: string; previousScore: number | null };
    history: { date: string; score: number | null }[];
  };
  risk: {
    level: string;
    points: number;
    factors: { code: string; points: number; message: string }[];
    strengths: string[];
    direction: string;
    previousLevel: string | null;
  };
  methodology: { risk: { disclaimer: string } };
}

/** Teacher drill-down: risk reasons, engagement breakdown and weekly trend for one student. */
export function StudentInsightsModal({
  studentId,
  onClose,
  footer,
}: {
  studentId: string | null;
  onClose: () => void;
  footer?: (insights: Insights) => React.ReactNode;
}) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let ignore = false;
    apiFetch<Insights>(`/teacher/students/${studentId}/insights`).then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else setError(res.error || "Could not load student insights.");
    });
    return () => {
      ignore = true;
      setData(null);
    };
  }, [studentId]);

  return (
    <Modal
      isOpen={Boolean(studentId)}
      onClose={onClose}
      title={data ? `${data.student.name} (${data.student.studentId})` : "Student insights"}
      subtitle={data ? `${data.student.className} • Roll ${data.student.rollNumber}` : undefined}
      maxWidth="xl"
    >
      {error && (
        <p className="text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}
      {!data && !error && (
        <p className="text-xs text-slate-500 flex items-center gap-2 py-8 justify-center">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading insights…
        </p>
      )}
      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">Risk indicator</span>
            <RiskBadge level={data.risk.level} />
            <span className="text-xs text-slate-500 font-mono">{data.risk.points} pts</span>
            <RiskDirection direction={data.risk.direction} />
            <span className="mx-2 h-4 w-px bg-slate-200" />
            <span className="text-xs text-slate-500">Engagement</span>
            <span className="text-sm font-bold text-slate-900">{data.engagement.overallScore ?? "—"}/100</span>
            <TrendBadge
              trend={data.engagement.trend.trend}
              delta={data.engagement.overallScore !== null && data.engagement.trend.previousScore !== null ? data.engagement.overallScore - data.engagement.trend.previousScore : null}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-xs font-bold text-slate-800 mb-2">Why this risk level</p>
              {data.risk.factors.length === 0 ? (
                <p className="text-xs text-slate-500">No risk rules triggered.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.risk.factors.map((f) => (
                    <li key={f.code} className="text-xs text-slate-700 flex gap-2">
                      <span className="font-mono text-[10px] text-rose-700 bg-white border border-rose-200 rounded px-1 h-fit">+{f.points}</span>
                      {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-bold text-slate-800 mb-2">Strengths</p>
              {data.risk.strengths.length === 0 ? (
                <p className="text-xs text-slate-500">None recorded in this period.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.risk.strengths.map((s) => (
                    <li key={s} className="text-xs text-slate-700 flex gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <ComponentBreakdown components={data.engagement.components} />

          <div>
            <p className="text-xs font-bold text-slate-800 mb-1">Engagement — weekly</p>
            <TrendLine data={data.engagement.history.map((h) => ({ label: formatDate(h.date).replace(/, \d{4}$/, ""), value: h.score }))} height={170} valueName="Engagement" />
          </div>
          <p className="text-[11px] text-slate-400">{data.methodology.risk.disclaimer}</p>
          {footer?.(data)}
        </div>
      )}
    </Modal>
  );
}
