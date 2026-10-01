import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

    const variants = {
      primary:
        "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:bg-indigo-800",
      secondary:
        "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200",
      outline:
        "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs",
      ghost:
        "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:bg-rose-800",
      success:
        "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:bg-emerald-800",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs font-medium gap-1.5",
      md: "px-4 py-2 text-sm font-medium gap-2",
      lg: "px-5 py-2.5 text-base font-semibold gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
