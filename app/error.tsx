"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { BMU, BMUCrest } from "@/components/brand/BMUBrand";

/** Catches unexpected rendering errors in any page and offers a retry instead of a blank screen. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[AttendIQ] Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 border-t-[3px] border-t-accent-500 rounded-xl shadow-[var(--shadow-raised)] p-6 sm:p-8 text-center space-y-5">
        <div className="flex flex-col items-center gap-2">
          <BMUCrest height={52} />
          <p className="eyebrow text-brand-700">{BMU.name}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-brand-950">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">This page hit an unexpected error. Your data is safe — try again, or go back to your dashboard.</p>
          {error.digest && <p className="text-[11px] text-slate-500 mt-2 font-mono">Reference: {error.digest}</p>}
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <button onClick={() => retry()} className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors">
            <RotateCw className="w-3.5 h-3.5" /> Try again
          </button>
          <Link href="/" className="inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
