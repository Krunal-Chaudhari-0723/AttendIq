"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CameraView } from "@/components/face/CameraView";
import { apiFetch } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import { useCamera, CAMERA_ERROR_MESSAGES, CameraError } from "@/lib/face/useCamera";
import { loadFaceEngine } from "@/lib/face/faceEngine";
import { captureFrontalDescriptors, CaptureAborted, CaptureTimeout } from "@/lib/face/capture";
import { runHeadTurnChallenge, LivenessAbort, LivenessChallenge, ChallengeStep } from "@/lib/face/liveness";
import {
  Camera,
  MapPin,
  Radio,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  XCircle,
  Clock,
  Wifi,
} from "lucide-react";

interface OpenSessionInfo {
  faceEnrolled: boolean;
  campus: { name: string | null; configured: boolean; enforced: boolean; radiusMeters: number | null };
  session: {
    id: string;
    subjectName: string;
    className: string;
    division?: string;
    teacherName: string;
    mode: "PHYSICAL" | "REMOTE";
    room?: string;
    startTime: string;
    endTime: string;
    lateAfterMinutes: number;
    requiresLocation: boolean;
  } | null;
  record: { status: string; markedAt: string; verificationMethod: string; confidence: number } | null;
}

interface VerifyResult {
  status: "PRESENT" | "LATE";
  subjectName: string;
  markedAt: string;
  verificationMethod: string;
  confidence: number;
  location: { verified: boolean; distanceMeters?: number; radiusMeters?: number };
}

type Step = "IDLE" | "LOCATION" | "SESSION" | "FACE" | "LIVENESS" | "SUBMITTING" | "VERIFIED" | "FAILED";

const PIPELINE: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "LOCATION", label: "1. Location", icon: MapPin },
  { key: "SESSION", label: "2. Session", icon: Radio },
  { key: "FACE", label: "3. Face", icon: ScanFace },
  { key: "LIVENESS", label: "4. Liveness", icon: Sparkles },
  { key: "VERIFIED", label: "5. Verified", icon: CheckCircle2 },
];
const ORDER: Step[] = ["LOCATION", "SESSION", "FACE", "LIVENESS", "SUBMITTING", "VERIFIED"];

const GEO_ERRORS: Record<number, string> = {
  1: "Location permission was denied. Allow location access for this site (lock icon in the address bar) and try again.",
  2: "Your location is unavailable. Turn on device location services and try again.",
  3: "Getting your location timed out. Move near a window or enable precise location and try again.",
};

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 2 });
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });

export default function StudentLiveAttendancePage() {
  const camera = useCamera();
  const [info, setInfo] = useState<OpenSessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("IDLE");
  const [failedAt, setFailedAt] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [tone, setTone] = useState<"idle" | "searching" | "good" | "bad">("idle");
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [challengeStep, setChallengeStep] = useState<ChallengeStep | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const busy = !["IDLE", "VERIFIED", "FAILED"].includes(step);
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const loadInfo = useCallback(async () => {
    const res = await apiFetch<OpenSessionInfo>("/student/attendance-session");
    if (res.success && res.data) {
      setInfo(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error || "Could not load attendance session.");
    }
  }, []);

  // Initial load + light polling so a newly started session appears without a manual refresh
  useEffect(() => {
    let active = true;
    const tick = () =>
      apiFetch<OpenSessionInfo>("/student/attendance-session").then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setInfo(res.data);
          setLoadError(null);
        } else {
          setLoadError(res.error || "Could not load attendance session.");
        }
      });
    tick();
    const id = setInterval(() => {
      if (!busyRef.current) tick();
    }, 15000);
    const cancel = cancelRef.current;
    return () => {
      active = false;
      clearInterval(id);
      cancel.cancelled = true;
    };
  }, []);

  const fail = (at: Step, message: string) => {
    setFailedAt(at);
    setError(message);
    setStep("FAILED");
    setTone("idle");
    setHint(null);
    camera.stop();
  };

  const abortAttempt = (attemptId: string, code: string) =>
    apiFetch(`/student/attendance/attempts/${attemptId}/abort`, { method: "POST", body: JSON.stringify({ code }) });

  const startVerification = async () => {
    if (!info?.session) return;
    const session = info.session;
    cancelRef.current = { cancelled: false };
    setError(null);
    setFailedAt(null);
    setResult(null);
    setDistance(null);
    setChallenge(null);
    setChallengeStep(null);

    // ---- 1. Location (only when the session requires campus presence) ----
    let location: { latitude: number; longitude: number; accuracy: number } | undefined;
    setStep("LOCATION");
    if (session.requiresLocation) {
      try {
        const pos = await getPosition();
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
      } catch (err) {
        fail("LOCATION", GEO_ERRORS[(err as GeolocationPositionError)?.code] || GEO_ERRORS[2]);
        return;
      }
    }

    // ---- 2. Server checks session + computes campus distance ----
    setStep("SESSION");
    const pre = await apiFetch<{
      attemptId: string;
      challenge: LivenessChallenge;
      location: { verified: boolean; distanceMeters?: number };
      code?: string;
    }>("/student/attendance/precheck", { method: "POST", body: JSON.stringify({ sessionId: session.id, location }) });
    if (!pre.success || !pre.data?.attemptId) {
      const code = pre.data?.code || "";
      const locationCodes = ["OUTSIDE_RADIUS", "LOCATION_IMPRECISE", "LOCATION_REQUIRED", "CAMPUS_NOT_CONFIGURED"];
      fail(locationCodes.includes(code) ? "LOCATION" : "SESSION", pre.error || "Pre-check failed.");
      if (code === "DUPLICATE_ATTENDANCE" || code === "SESSION_EXPIRED") loadInfo();
      return;
    }
    const { attemptId } = pre.data;
    setChallenge(pre.data.challenge);
    if (pre.data.location.verified && pre.data.location.distanceMeters !== undefined) setDistance(pre.data.location.distanceMeters);

    // ---- 3. Camera + frontal face ----
    setStep("FACE");
    try {
      await loadFaceEngine();
    } catch {
      await abortAttempt(attemptId, "PROCESSING_FAILURE");
      fail("FACE", "Face recognition models could not be loaded. Check your connection and retry.");
      return;
    }
    const camErr: CameraError | null = (await camera.start()) ?? (camera.videoRef.current ? null : "CAMERA_UNAVAILABLE");
    if (camErr || !camera.videoRef.current) {
      const code = camErr ?? "CAMERA_UNAVAILABLE";
      await abortAttempt(attemptId, code === "CAMERA_DENIED" ? "CAMERA_DENIED" : "CAMERA_UNAVAILABLE");
      fail("FACE", CAMERA_ERROR_MESSAGES[code]);
      return;
    }
    const video = camera.videoRef.current;

    let startDescriptor: number[];
    let endDescriptor: number[];
    let liveness: Awaited<ReturnType<typeof runHeadTurnChallenge>>;
    let phase: Step = "FACE";
    try {
      setTone("searching");
      [startDescriptor] = await captureFrontalDescriptors(video, {
        count: 1,
        signal: cancelRef.current,
        onFrame: (frame, message) => {
          setHint(message);
          setTone(frame.ok ? "good" : frame.faceCount === 0 ? "searching" : "bad");
        },
      });

      // ---- 4. Liveness: server-issued head-turn challenge ----
      phase = "LIVENESS";
      setStep("LIVENESS");
      setTone("good");
      liveness = await runHeadTurnChallenge(video, pre.data.challenge, {
        signal: cancelRef.current,
        onStep: (s) => {
          setChallengeStep(s);
          setHint(null);
        },
      });
      [endDescriptor] = await captureFrontalDescriptors(video, { count: 1, stableFrames: 1, timeoutMs: 8000, signal: cancelRef.current });
    } catch (err) {
      if (err instanceof CaptureAborted) {
        await abortAttempt(attemptId, "CANCELLED");
        fail(phase, "Verification cancelled.");
      } else if (err instanceof LivenessAbort) {
        await abortAttempt(attemptId, err.code);
        fail("LIVENESS", err.message);
      } else if (err instanceof CaptureTimeout) {
        await abortAttempt(attemptId, phase === "LIVENESS" ? "LIVENESS_FAILED" : "POOR_QUALITY");
        fail(phase, `Could not complete the ${phase === "LIVENESS" ? "liveness" : "face"} check: ${err.lastIssue}`);
      } else {
        await abortAttempt(attemptId, "PROCESSING_FAILURE");
        fail("FACE", "Face processing failed on this device. Please retry.");
      }
      return;
    } finally {
      camera.stop();
      setTone("idle");
      setHint(null);
    }

    // ---- 5. Server: liveness + identity + record ----
    setStep("SUBMITTING");
    const res = await apiFetch<VerifyResult & { code?: string }>("/student/attendance/verify", {
      method: "POST",
      body: JSON.stringify({
        attemptId,
        liveness: { frames: liveness.frames },
        descriptors: { start: startDescriptor, peak: liveness.peakDescriptor, end: endDescriptor },
      }),
    });
    if (res.success && res.data) {
      setResult(res.data);
      setStep("VERIFIED");
      loadInfo();
    } else {
      const code = res.data?.code;
      fail(code === "LIVENESS_FAILED" ? "LIVENESS" : code === "FACE_MISMATCH" ? "FACE" : "SESSION", res.error || "Verification failed.");
    }
  };

  const cancel = () => {
    cancelRef.current.cancelled = true;
  };

  const session = info?.session;
  const stepIndex = ORDER.indexOf(step === "FAILED" ? (failedAt as Step) : step);
  const cameraVisible = step === "FACE" || step === "LIVENESS";
  const turnLeft = challenge === "TURN_LEFT";

  const instruction =
    step === "LIVENESS"
      ? challengeStep === "TURN"
        ? `Slowly turn your head to your ${turnLeft ? "LEFT" : "RIGHT"}`
        : challengeStep === "RETURN"
        ? "Now look straight back at the camera"
        : "Look straight at the camera"
      : null;

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell
        title="Live Attendance Verification"
        subtitle="Verify campus presence and identity for the active class session"
        defaultRole="STUDENT"
      >
        <div className="space-y-6 max-w-4xl mx-auto">
          {loadError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {loadError}
            </div>
          )}

          {/* Session bar */}
          {!info ? (
            <div className="p-6 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Checking for an active session…
            </div>
          ) : session ? (
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 flex-wrap">
                    <span>
                      {session.subjectName} • {session.className}
                      {session.division ? ` (${session.division})` : ""}
                    </span>
                    <Badge variant="success" size="sm">Session Active</Badge>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {session.teacherName}
                    {session.room ? ` • ${session.room}` : ""} • {formatTime(session.startTime)} – {formatTime(session.endTime)} •
                    late after {session.lateAfterMinutes} min
                  </p>
                </div>
              </div>
              <Badge variant="purple" size="sm" className="bg-white/10 text-white border-white/20 gap-1">
                {session.mode === "PHYSICAL" ? <MapPin className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                {session.mode === "PHYSICAL" ? (session.requiresLocation ? "Physical • campus check" : "Physical") : "Remote"}
              </Badge>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">No active attendance session</h3>
                  <p className="text-xs text-slate-400">
                    When your teacher opens attendance for your class it will appear here automatically.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={loadInfo} className="text-xs border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
          )}

          {/* Pipeline tracker */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <p className="text-[11px] uppercase font-bold text-slate-400 mb-3 tracking-wider">Verification Pipeline</p>
            <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold">
              {PIPELINE.map(({ key, label, icon: Icon }) => {
                const idx = ORDER.indexOf(key);
                const isFailed = step === "FAILED" && failedAt === key;
                const isCurrent = !isFailed && step !== "VERIFIED" && (step === key || (key === "VERIFIED" && step === "SUBMITTING"));
                const isDone = step === "VERIFIED" || (stepIndex > idx && !isFailed && step !== "IDLE");
                return (
                  <div
                    key={key}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      isFailed
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : isCurrent
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-200"
                        : isDone
                        ? key === "VERIFIED"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    )}
                  >
                    {isFailed ? <XCircle className="w-4 h-4 mx-auto mb-1" /> : <Icon className="w-4 h-4 mx-auto mb-1" />}
                    <span className="text-[10px]">{label}</span>
                  </div>
                );
              })}
            </div>
            {session && !session.requiresLocation && (
              <p className="text-[11px] text-slate-400 mt-2">
                {session.mode === "REMOTE"
                  ? "Remote session: campus location is not required; face and liveness are still verified."
                  : "Campus location enforcement is disabled by the administrator."}
              </p>
            )}
          </div>

          {/* Verification surface */}
          <Card className="overflow-hidden bg-slate-950 border-slate-800">
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px] text-white gap-4">
              <div className={cameraVisible ? "w-full flex flex-col items-center gap-3" : "hidden"}>
                {instruction && (
                  <div className="flex items-center gap-3 text-base font-bold">
                    {challengeStep === "TURN" && turnLeft && <ArrowLeft className="w-6 h-6 text-amber-400 animate-pulse" />}
                    <span>{instruction}</span>
                    {challengeStep === "TURN" && !turnLeft && <ArrowRight className="w-6 h-6 text-amber-400 animate-pulse" />}
                  </div>
                )}
                <CameraView videoRef={camera.videoRef} active={camera.isActive} tone={tone} hint={hint} />
                {step === "FACE" && !camera.isActive && (
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Starting camera…
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={cancel} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs">
                  Cancel
                </Button>
              </div>

              {(step === "LOCATION" || step === "SESSION" || step === "SUBMITTING") && (
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" />
                  <div>
                    <h3 className="text-base font-bold">
                      {step === "LOCATION" && (session?.requiresLocation ? "Getting your location…" : "Preparing…")}
                      {step === "SESSION" && "Verifying session and campus distance…"}
                      {step === "SUBMITTING" && "Verifying liveness and identity…"}
                    </h3>
                    {step === "LOCATION" && session?.requiresLocation && (
                      <p className="text-xs text-slate-400 mt-1">Allow location access when your browser asks. It is used only for this check.</p>
                    )}
                  </div>
                </div>
              )}

              {step === "IDLE" && (
                <div className="text-center space-y-4 max-w-sm">
                  {info?.record ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold">Attendance already recorded</h3>
                      <p className="text-xs text-slate-400">
                        Marked {info.record.status} at {formatTime(info.record.markedAt)} for this session.
                      </p>
                    </>
                  ) : info && !info.faceEnrolled ? (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
                        <ScanFace className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold">Face enrollment required</h3>
                      <p className="text-xs text-slate-400">Enroll your face once before marking attendance.</p>
                      <Link href="/student/face-enrollment">
                        <Button size="sm" className="text-xs gap-1.5">
                          Enroll Face <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Mark Attendance</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {session?.requiresLocation
                            ? "We will check your location once, then verify your face with a short head-turn check."
                            : "We will verify your face with a short head-turn check."}
                        </p>
                      </div>
                      <Button onClick={startVerification} disabled={!session} size="lg" className="w-full text-xs font-bold py-3">
                        {session ? "Mark Attendance" : "Waiting for an active session"}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {step === "VERIFIED" && result && (
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <Badge variant={result.status === "LATE" ? "warning" : "success"} size="md" className="mb-2">
                      ATTENDANCE MARKED: {result.status}
                    </Badge>
                    <h3 className="text-base font-bold">Identity and presence verified</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {result.subjectName} • {formatTime(result.markedAt)} • face similarity {Math.round(result.confidence * 100)}%
                      {result.location.verified && result.location.distanceMeters !== undefined
                        ? ` • ${result.location.distanceMeters} m from campus centre`
                        : ""}
                    </p>
                  </div>
                </div>
              )}

              {step === "FAILED" && (
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Attendance not marked</h3>
                    <p className="text-xs text-rose-300 mt-1 leading-relaxed">{error}</p>
                    {distance !== null && failedAt !== "LOCATION" && (
                      <p className="text-[11px] text-slate-500 mt-1">Location check passed ({distance} m from campus centre).</p>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      setStep("IDLE");
                      loadInfo();
                    }}
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-[11px] text-slate-400 text-center">
            Location is read once per attempt and only the distance from campus is stored. Camera frames never leave your device.
          </p>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
