"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { apiFetch } from "@/lib/api";
import { ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

interface Standing {
  level: string;
  label: string;
  areasToImprove: string[];
  strengths: string[];
  direction: string;
  disclaimer: string;
}

/** Student-facing risk indicator: supportive wording, reasons and strengths, no internal points. */
export function AcademicStanding() {
  const [data, setData] = useState<Standing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Standing>("/student/risk").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error || "Could not load academic standing.");
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-600" /> Academic standing
          {data && (
            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
              {data.label} <RiskBadge level={data.level} />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-xs text-rose-700">{error}</p>}
        {!data && !error && <p className="text-xs text-slate-500">Loading…</p>}
        {data && (
          <>
            {data.direction === "RISING" && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                More concerns than last week — small steps now make a big difference.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-brand-950 mb-2">Areas to improve</p>
                {data.areasToImprove.length === 0 ? (
                  <p className="text-xs text-slate-500">Nothing flagged — keep it up.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.areasToImprove.map((a) => (
                      <li key={a} className="text-xs text-slate-700 flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /> {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-brand-950 mb-2">Strengths</p>
                {data.strengths.length === 0 ? (
                  <p className="text-xs text-slate-500">None recorded yet this month.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.strengths.map((s) => (
                      <li key={s} className="text-xs text-slate-700 flex gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{data.disclaimer}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
