import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const fieldStyles =
  "flex h-10 w-full rounded-lg border border-slate-300 bg-white py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 transition-colors duration-150";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative flex items-center w-full">
          <div className="absolute left-3 text-slate-400 pointer-events-none">{icon}</div>
          <input type={type} className={cn(fieldStyles, "pl-9 pr-3", className)} ref={ref} {...props} />
        </div>
      );
    }

    return <input type={type} className={cn(fieldStyles, "px-3", className)} ref={ref} {...props} />;
  }
);
Input.displayName = "Input";
