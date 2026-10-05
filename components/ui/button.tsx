import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = BMU navy; accent = BMU orange (reserve for the one key action on a screen). */
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

    const variants = {
      primary: "bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white shadow-xs",
      accent: "bg-accent-600 hover:bg-accent-700 active:bg-accent-800 text-white shadow-xs",
      secondary: "bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-100",
      outline: "border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-700",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs",
      success: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs",
    };

    const sizes = {
      sm: "min-h-8 px-3 py-1 text-xs gap-1.5",
      md: "min-h-10 px-4 py-2 text-sm gap-2",
      lg: "min-h-11 px-5 py-2.5 text-sm font-semibold gap-2",
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
