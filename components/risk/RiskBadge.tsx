"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";

/** Risk level always shown with icon + word, never colour alone. */
export function RiskBadge({ level }: { level: string }) {
  if (level === "HIGH")
    return (
      <Badge variant="danger" size="sm" className="gap-1">
        <AlertOctagon className="w-3 h-3" /> High
      </Badge>
    );
  if (level === "MEDIUM")
    return (
      <Badge variant="warning" size="sm" className="gap-1">
        <AlertTriangle className="w-3 h-3" /> Medium
      </Badge>
    );
  if (level === "LOW")
    return (
      <Badge variant="success" size="sm" className="gap-1">
        <CheckCircle2 className="w-3 h-3" /> Low
      </Badge>
    );
  return (
    <Badge variant="neutral" size="sm" className="gap-1">
      <HelpCircle className="w-3 h-3" /> No data
    </Badge>
  );
}

export function RiskDirection({ direction }: { direction: string }) {
  if (direction === "RISING")
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700">
        <ArrowUpRight className="w-3.5 h-3.5" /> Rising
      </span>
    );
  if (direction === "FALLING")
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700">
        <ArrowDownRight className="w-3.5 h-3.5" /> Easing
      </span>
    );
  if (direction === "STEADY") return <span className="text-[11px] text-slate-500">Steady</span>;
  return <span className="text-[11px] text-slate-400">—</span>;
}
