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

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  iconBg = "bg-indigo-50 text-indigo-600",
  description,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-2xl font-bold tracking-tight text-slate-900">
                {value}
              </h4>
              {change && (
                <span
                  className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded",
                    changeType === "positive" && "bg-emerald-50 text-emerald-700",
                    changeType === "negative" && "bg-rose-50 text-rose-700",
                    changeType === "neutral" && "bg-slate-100 text-slate-600"
                  )}
                >
                  {change}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-slate-400 mt-1">{description}</p>
            )}
          </div>
          {icon && (
            <div className={cn("p-3 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
