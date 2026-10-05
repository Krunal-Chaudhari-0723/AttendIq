import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** "purple" is kept for compatibility and renders as the BMU brand tag. */
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "brand" | "accent";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-medium rounded-md border whitespace-nowrap transition-colors focus:outline-none";

  const brand = "bg-brand-50 text-brand-700 border-brand-200";
  const variants = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    purple: brand,
    brand,
    accent: "bg-accent-50 text-accent-700 border-accent-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[11px] gap-1",
    md: "px-2 py-0.5 text-xs gap-1.5 font-semibold",
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}
