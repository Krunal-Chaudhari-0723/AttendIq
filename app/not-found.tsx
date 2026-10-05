import Link from "next/link";
import { Compass } from "lucide-react";
import { BMU, BMUCrest } from "@/components/brand/BMUBrand";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 border-t-[3px] border-t-accent-500 rounded-xl shadow-[var(--shadow-raised)] p-6 sm:p-8 text-center space-y-5">
        <div className="flex flex-col items-center gap-2">
          <BMUCrest height={52} priority />
          <p className="eyebrow text-brand-700">{BMU.name}</p>
        </div>
        <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mx-auto">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-brand-950">Page not found</h2>
          <p className="text-xs text-slate-500 mt-1">The page you are looking for does not exist or has moved.</p>
        </div>
        <Link href="/login" className="inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
