import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  iconBg?: string;
  description?: string;
  className?: string;
}

/** KPI tile: label, figure, optional change chip and context line. */
export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  iconBg = "bg-brand-50 text-brand-700",
  description,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="eyebrow truncate">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h4 className="text-2xl font-semibold tracking-tight text-brand-950 tabular-nums">{value}</h4>
              {change && (
                <span
                  className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded",
                    changeType === "positive" && "bg-emerald-50 text-emerald-700",
                    changeType === "negative" && "bg-rose-50 text-rose-700",
                    changeType === "neutral" && "bg-slate-100 text-slate-600"
                  )}
                >
                  {change}
                </span>
              )}
            </div>
            {description && <p className="text-xs text-slate-500 leading-snug">{description}</p>}
          </div>
          {icon && (
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
