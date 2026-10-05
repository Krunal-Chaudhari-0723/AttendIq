"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Segmented tabs; the active tab carries the BMU orange underline. */
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
    <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 max-w-full">
      {tabs.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "relative px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
            value === v
              ? "bg-white text-brand-800 shadow-xs after:absolute after:left-3 after:right-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent-500"
              : "text-slate-600 hover:text-brand-800"
          )}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
