"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

export interface FilterState {
  from: string;
  to: string;
  classId: string;
  subjectId: string;
}

export const defaultFilters = (): FilterState => {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to), classId: "", subjectId: "" };
};

export const toQuery = (f: FilterState, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ from: f.from, to: f.to, ...extra });
  if (f.classId) p.set("classId", f.classId);
  if (f.subjectId) p.set("subjectId", f.subjectId);
  return p.toString();
};

/** One row of report filters: date range, class, subject + refresh/export. */
export function ReportFilters({
  value,
  onChange,
  classes,
  subjects,
  showSubject = true,
  loading,
  onRefresh,
  onExport,
  exporting,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  classes?: { id: string; name: string; division?: string }[];
  subjects?: { id: string; name: string; classId: string }[];
  showSubject?: boolean;
  loading?: boolean;
  onRefresh: () => void;
  onExport?: () => void;
  exporting?: boolean;
}) {
  const subjectOptions = (subjects ?? []).filter((s) => !value.classId || s.classId === value.classId);
  const select = "h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-[11px] font-semibold text-slate-500 space-y-1">
        <span className="block">From</span>
        <input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} className={select} />
      </label>
      <label className="text-[11px] font-semibold text-slate-500 space-y-1">
        <span className="block">To</span>
        <input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} className={select} />
      </label>
      {classes && (
        <label className="text-[11px] font-semibold text-slate-500 space-y-1">
          <span className="block">Class</span>
          <select value={value.classId} onChange={(e) => onChange({ ...value, classId: e.target.value, subjectId: "" })} className={select}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.division ? ` (${c.division})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {showSubject && subjects && (
        <label className="text-[11px] font-semibold text-slate-500 space-y-1">
          <span className="block">Subject</span>
          <select value={value.subjectId} onChange={(e) => onChange({ ...value, subjectId: e.target.value })} className={select}>
            <option value="">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-9" onClick={onRefresh}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        {onExport && (
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-9" onClick={onExport} disabled={exporting}>
            <Download className="w-3.5 h-3.5" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        )}
      </div>
    </div>
  );
}
