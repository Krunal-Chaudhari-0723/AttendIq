"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import { Sparkles, ListChecks, ChevronDown, ChevronRight, CheckCircle2, User, GraduationCap } from "lucide-react";

export interface RecommendationItem {
  index: number;
  action: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  audience: "STUDENT" | "TEACHER";
  supportingFactors: string[];
  completedAt: string | null;
}

export interface RecommendationData {
  id: string;
  summary: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  riskLevel: string;
  source: "AI" | "RULE_BASED";
  sourceLabel: string;
  aiModel?: string;
  fallbackReason?: string;
  generatedAt: string;
  generatedByRole: string;
  recommendations: RecommendationItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ATTENDANCE: "Attendance",
  ASSIGNMENT_SUPPORT: "Assignment support",
  REVISION: "Revision",
  EXTRA_PRACTICE: "Extra practice",
  TEACHER_INTERVENTION: "Teacher intervention",
  PARENT_COMMUNICATION: "Parent communication",
  MENTORING: "Mentoring",
  FOLLOW_UP: "Follow-up",
};

const priorityVariant = (p: string) => (p === "HIGH" ? "danger" : p === "MEDIUM" ? "warning" : "neutral");

/** Always states whether the content came from AI or the rule engine. */
export function SourceBadge({ rec, showReason }: { rec: RecommendationData; showReason?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {rec.source === "AI" ? (
        <Badge variant="purple" size="sm" className="gap-1">
          <Sparkles className="w-3 h-3" /> AI-generated
        </Badge>
      ) : (
        <Badge variant="neutral" size="sm" className="gap-1">
          <ListChecks className="w-3 h-3" /> Rule-based
        </Badge>
      )}
      {showReason && rec.source !== "AI" && rec.fallbackReason && (
        <span className="text-[11px] text-slate-400">({rec.fallbackReason})</span>
      )}
    </span>
  );
}

export function RecommendationCard({
  rec,
  showAudience = true,
  showReason = false,
  onComplete,
}: {
  rec: RecommendationData;
  showAudience?: boolean;
  showReason?: boolean;
  onComplete?: (item: RecommendationItem) => Promise<void>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SourceBadge rec={rec} showReason={showReason} />
        <span className="text-[11px] text-slate-400">
          Generated {formatDate(rec.generatedAt)} {formatTime(rec.generatedAt)}
          {rec.source === "AI" && rec.aiModel ? ` • ${rec.aiModel}` : ""}
        </span>
      </div>
      <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-slate-800">Summary</span>
          <Badge variant={priorityVariant(rec.priority)} size="sm">{rec.priority} priority</Badge>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{rec.summary}</p>
      </div>

      {rec.recommendations.length === 0 ? (
        <p className="text-xs text-slate-500">No actions for you in this recommendation.</p>
      ) : (
        <ul className="space-y-3">
          {rec.recommendations.map((item) => (
            <li key={item.index} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className={`text-sm font-bold ${item.completedAt ? "text-slate-400 line-through" : "text-slate-900"}`}>{item.action}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {showAudience && (
                    <Badge variant="info" size="sm" className="gap-1">
                      {item.audience === "STUDENT" ? <User className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                      {item.audience === "STUDENT" ? "Student" : "Teacher"}
                    </Badge>
                  )}
                  <Badge variant="neutral" size="sm">{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                  <Badge variant={priorityVariant(item.priority)} size="sm">{item.priority}</Badge>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => setOpen(open === item.index ? null : item.index)}
                  className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1"
                >
                  {open === item.index ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Based on {item.supportingFactors.length} recorded fact{item.supportingFactors.length === 1 ? "" : "s"}
                </button>
                {onComplete && item.audience === "STUDENT" &&
                  (item.completedAt ? (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Done {formatDate(item.completedAt)}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === item.index}
                      className="text-xs gap-1"
                      onClick={async () => {
                        setBusy(item.index);
                        await onComplete(item);
                        setBusy(null);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> {busy === item.index ? "Saving…" : "Mark as done"}
                    </Button>
                  ))}
              </div>
              {open === item.index && (
                <ul className="mt-2 space-y-1 text-[11px] text-slate-500 list-disc pl-5">
                  {item.supportingFactors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
