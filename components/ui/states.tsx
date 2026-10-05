import * as React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Shown when a list or section has no data yet. Never replace with sample data. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-10", className)}>
      <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-brand-950">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-12 text-xs text-slate-500", className)} role="status">
      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800", className)} role="alert">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">Something went wrong</p>
        <p className="text-xs mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      )}
    </div>
  );
}
