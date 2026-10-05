"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** Visual state of the face guide */
  tone?: "idle" | "searching" | "good" | "bad";
  hint?: string | null;
  children?: React.ReactNode;
}

const toneRing: Record<NonNullable<CameraViewProps["tone"]>, string> = {
  idle: "border-white/30",
  searching: "border-brand-400/80",
  good: "border-emerald-400",
  bad: "border-amber-400",
};

/**
 * Mirrored selfie preview with an oval face guide.
 * The <video> stays mounted at all times so the camera hook can attach the stream.
 */
export function CameraView({ videoRef, active, tone = "idle", hint, children }: CameraViewProps) {
  return (
    <div className="relative w-full max-w-md aspect-[4/3] rounded-xl overflow-hidden bg-brand-950 border border-brand-800 ring-1 ring-slate-200 ring-offset-2 ring-offset-white">
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn("absolute inset-0 w-full h-full object-cover -scale-x-100", !active && "opacity-0")}
      />
      {active && (
        <div className="absolute inset-3 pointer-events-none" aria-hidden="true">
          <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/70 rounded-tl-md" />
          <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/70 rounded-tr-md" />
          <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/70 rounded-bl-md" />
          <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/70 rounded-br-md" />
        </div>
      )}
      {active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={cn("w-[46%] h-[72%] rounded-[50%] border-[3px] transition-colors duration-200", toneRing[tone])} />
        </div>
      )}
      {active && hint && (
        <div className="absolute bottom-3 inset-x-3 text-center">
          <span
            className={cn(
              "inline-block px-3 py-1.5 rounded-md text-xs font-semibold border border-white/10",
              tone === "good" ? "bg-emerald-700/90 text-white" : tone === "bad" ? "bg-amber-500/90 text-slate-950" : "bg-brand-950/85 text-white"
            )}
          >
            {hint}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
