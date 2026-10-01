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
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-bold text-slate-800 leading-tight">{c.label}</span>
              <Badge variant="purple" size="sm">{Math.round(c.weight * 100)}%</Badge>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">
              {missing ? <span className="text-base font-semibold text-slate-400">No data</span> : c.score}
              {!missing && <span className="text-xs font-normal text-slate-400"> / 100</span>}
            </p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.score ?? 0}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{c.detail}</p>
            <p className="text-[10px] text-slate-400 font-mono">
              {missing ? "Weight redistributed" : `+${c.contribution} pts`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
