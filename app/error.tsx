"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Catches unexpected rendering errors in any page and offers a retry instead of a blank screen. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[AttendIQ] Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-1">This page hit an unexpected error. Your data is safe — try again, or go back to your dashboard.</p>
          {error.digest && <p className="text-[10px] text-slate-400 mt-2 font-mono">Reference: {error.digest}</p>}
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={() => retry()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
            <RotateCw className="w-3.5 h-3.5" /> Try again
          </button>
          <Link href="/" className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
