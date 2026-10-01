"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Simple segmented tabs. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; icon?: React.ElementType }[];
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
      {tabs.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors",
            value === v ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
          )}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
