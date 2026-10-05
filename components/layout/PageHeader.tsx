import React from "react";
import { cn } from "@/lib/utils";

/** Page title block at the top of the content area. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 sm:mb-6", className)}>
      <div className="min-w-0 border-l-[3px] border-accent-500 pl-3">
        {eyebrow && <p className="eyebrow text-brand-600 mb-0.5">{eyebrow}</p>}
        <h1 className="text-xl sm:text-2xl font-semibold text-brand-950 tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-snug">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
