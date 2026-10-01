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
  searching: "border-indigo-400/80",
  good: "border-emerald-400",
  bad: "border-amber-400",
};

/**
 * Mirrored selfie preview with an oval face guide.
 * The <video> stays mounted at all times so the camera hook can attach the stream.
 */
export function CameraView({ videoRef, active, tone = "idle", hint, children }: CameraViewProps) {
  return (
    <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn("absolute inset-0 w-full h-full object-cover -scale-x-100", !active && "opacity-0")}
      />
      {active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={cn("w-[46%] h-[72%] rounded-[50%] border-4 transition-colors duration-200", toneRing[tone])} />
        </div>
      )}
      {active && hint && (
        <div className="absolute bottom-3 inset-x-3 text-center">
          <span
            className={cn(
              "inline-block px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm",
              tone === "good" ? "bg-emerald-600/80 text-white" : tone === "bad" ? "bg-amber-500/85 text-slate-950" : "bg-slate-900/80 text-white"
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
