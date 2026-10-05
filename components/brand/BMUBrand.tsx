import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Official Bhagwan Mahavir University artwork, taken unmodified from bmusurat.ac.in:
 *   /brand/bmu-crest.png          crest only, transparent (cropped from the official logo)
 *   /brand/bmu-logo-light.webp    crest + wordmark, white/orange text — for dark backgrounds
 * Always render at the native aspect ratio; never recolour or stretch.
 */
const CREST_RATIO = 930 / 1238;
const LOGO_RATIO = 2710 / 1238;

export const BMU = {
  name: "Bhagwan Mahavir University",
  short: "BMU",
  location: "Vesu, Surat, Gujarat",
  product: "AttendIQ",
  tagline: "Smart Attendance & Student Engagement System",
};

export function BMUCrest({ height = 40, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/bmu-crest.png"
      alt="Bhagwan Mahavir University crest"
      width={Math.round(height * CREST_RATIO)}
      height={height}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
      style={{ width: Math.round(height * CREST_RATIO), height }}
    />
  );
}

/** Full university lockup. Only for navy/dark surfaces (the wordmark is white). */
export function BMULogo({ height = 56, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/bmu-logo-light.webp"
      alt="Bhagwan Mahavir University"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
      style={{ width: Math.round(height * LOGO_RATIO), height }}
    />
  );
}

/** Sidebar identity: official university lockup, then the AttendIQ product line. */
export function BMUSidebarBrand() {
  return (
    <div className="space-y-3">
      <BMULogo height={54} priority />
      <div className="pl-0.5 leading-tight">
        <p className="text-base font-semibold tracking-tight text-white">
          Attend<span className="text-accent-500">IQ</span>
        </p>
        <p className="text-[10.5px] text-brand-100/60">Smart Attendance &amp; Engagement</p>
      </div>
    </div>
  );
}

/** AttendIQ product wordmark set beside the crest. tone="dark" for navy surfaces. */
export function BMUBrand({ tone = "dark", compact = false, className }: { tone?: "dark" | "light"; compact?: boolean; className?: string }) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <BMUCrest height={compact ? 34 : 44} priority />
      <div className="min-w-0 leading-tight">
        <p className={cn("text-[9.5px] font-semibold uppercase tracking-[0.14em] truncate", dark ? "text-brand-100/80" : "text-brand-700")}>
          {BMU.name}
        </p>
        <p className={cn("font-semibold tracking-tight", compact ? "text-base" : "text-lg", dark ? "text-white" : "text-brand-950")}>
          Attend<span className="text-accent-500">IQ</span>
        </p>
        {!compact && (
          <p className={cn("text-[10.5px] truncate", dark ? "text-brand-100/60" : "text-slate-500")}>Smart Attendance &amp; Engagement</p>
        )}
      </div>
    </div>
  );
}
