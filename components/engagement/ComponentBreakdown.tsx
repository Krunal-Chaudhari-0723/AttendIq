"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

export type EngagementKey = "attendance" | "quiz" | "assignments" | "participation" | "learningActivity";

export interface EngagementComponent {
  key: EngagementKey;
  label: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  detail: string;
  sampleSize: number;
}

export const ENGAGEMENT_ORDER: EngagementKey[] = ["attendance", "quiz", "assignments", "participation", "learningActivity"];

/** Five-pillar breakdown cards: score, weight, weighted points and the data behind each pillar. */
export function ComponentBreakdown({ components }: { components: Record<EngagementKey, EngagementComponent> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {ENGAGEMENT_ORDER.map((key) => {
        const c = components[key];
        const missing = c.score === null;
        return (
          <div key={key} className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2 shadow-[var(--shadow-card)]">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-semibold text-brand-950 leading-tight">{c.label}</span>
              <Badge variant="brand" size="sm">{Math.round(c.weight * 100)}%</Badge>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-brand-950 tabular-nums">
              {missing ? <span className="text-base font-semibold text-slate-400">No data</span> : c.score}
              {!missing && <span className="text-xs font-normal text-slate-400"> / 100</span>}
            </p>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full" style={{ width: `${c.score ?? 0}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{c.detail}</p>
            <p className="text-[10.5px] font-medium text-slate-500 tabular-nums pt-1 border-t border-slate-100">
              {missing ? "Weight redistributed" : `+${c.contribution} pts`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
