"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CameraView } from "@/components/face/CameraView";
import { apiFetch } from "@/lib/api";
import { useCamera, CAMERA_ERROR_MESSAGES } from "@/lib/face/useCamera";
import { loadFaceEngine, FACE_MODEL_VERSION } from "@/lib/face/faceEngine";
import { captureFrontalDescriptors, CaptureAborted, CaptureTimeout } from "@/lib/face/capture";
import { formatDate } from "@/lib/utils";
import {
  ScanFace,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  RefreshCw,
  Lock,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface FaceStatus {
  enrolled: boolean;
  enrolledAt: string | null;
  modelVersion: string | null;
  sampleCount: number;
}

type Phase = "LOADING" | "INTRO" | "PREPARING" | "SCANNING" | "SUBMITTING" | "DONE" | "ENROLLED" | "TESTING";

interface TestResult {
  matched: boolean;
  confidence: number;
  reason: string;
}

const ENROLL_SAMPLES = 3;

export default function StudentFaceEnrollmentPage() {
  const camera = useCamera();
  const [phase, setPhase] = useState<Phase>("LOADING");
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [tone, setTone] = useState<"idle" | "searching" | "good" | "bad">("idle");
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    let ignore = false;
    apiFetch<FaceStatus>("/student/face/status").then((res) => {
      if (ignore) return;
      if (res.success && res.data) {
        setStatus(res.data);
        setPhase(res.data.enrolled ? "ENROLLED" : "INTRO");
      } else {
        setError(res.error || "Could not load enrollment status.");
        setPhase("INTRO");
      }
    });
    const cancel = cancelRef.current;
    return () => {
      ignore = true;
      cancel.cancelled = true;
    };
  }, []);

  const resetCamera = () => {
    cancelRef.current.cancelled = true;
    camera.stop();
    setHint(null);
    setTone("idle");
  };

  /** Shared: open camera + load models, then capture frontal descriptors. */
  const scanFace = async (count: number): Promise<number[][] | null> => {
    setError(null);
    setTestResult(null);
    setPhase("PREPARING");
    cancelRef.current = { cancelled: false };

    try {
      await loadFaceEngine();
    } catch {
      setError("Face recognition models could not be loaded. Check your connection and try again.");
      return null;
    }
    const cameraError = await camera.start();
    if (cameraError || !camera.videoRef.current) return null;

    setPhase("SCANNING");
    setTone("searching");
    try {
      return await captureFrontalDescriptors(camera.videoRef.current, {
        count,
        signal: cancelRef.current,
        onFrame: (frame, message) => {
          setHint(message);
          setTone(frame.ok ? "good" : frame.faceCount === 0 ? "searching" : "bad");
        },
      });
    } catch (err) {
      if (err instanceof CaptureAborted) return null;
      if (err instanceof CaptureTimeout) {
        setError(`Could not capture a clear face: ${err.lastIssue}`);
      } else {
        setError("Face processing failed on this device. Please retry.");
      }
      return null;
    } finally {
      camera.stop();
      setTone("idle");
      setHint(null);
    }
  };

  const startEnrollment = async () => {
    const samples = await scanFace(ENROLL_SAMPLES);
    if (!samples) {
      setPhase("INTRO");
      return;
    }
    setPhase("SUBMITTING");
    const res = await apiFetch("/student/face/enroll", {
      method: "POST",
      body: JSON.stringify({ samples, modelVersion: FACE_MODEL_VERSION }),
    });
    if (res.success) {
      setPhase("DONE");
      const s = await apiFetch<FaceStatus>("/student/face/status");
      if (s.success && s.data) setStatus(s.data);
    } else {
      setError(res.error || "Enrollment failed. Please try again.");
      setPhase("INTRO");
    }
  };

  const runIdentityTest = async () => {
    const samples = await scanFace(1);
    if (!samples) {
      setPhase("ENROLLED");
      return;
    }
    setPhase("SUBMITTING");
    const res = await apiFetch<TestResult>("/student/face/verify", {
      method: "POST",
      body: JSON.stringify({ descriptor: samples[0] }),
    });
    if (res.success && res.data) {
      setTestResult(res.data);
    } else {
      setError(res.error || "Verification failed. Please try again.");
    }
    setPhase("ENROLLED");
  };

  const cameraVisible = phase === "PREPARING" || phase === "SCANNING";
  const cameraError = camera.error ? CAMERA_ERROR_MESSAGES[camera.error] : null;

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell
        title="Face Enrollment"
        subtitle="Register your face once so attendance can verify that it is really you"
        defaultRole="STUDENT"
      >
        <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">
          {/* Privacy notice */}
          <div className="flex gap-3 p-4 rounded-lg bg-brand-50/60 border border-brand-100 text-xs text-brand-900">
            <Lock className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-brand-950">How your face data is handled</h4>
              <p className="leading-relaxed text-brand-900/85">
                Your camera image is processed on this device and is never uploaded or stored. Only a 128-number face
                signature is sent, encrypted at rest, and used solely to confirm your identity when you mark attendance.
                It is never shown to teachers, admins or other students.
              </p>
            </div>
          </div>

          {(error || cameraError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError || error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
            {/* Camera surface */}
            <Card className="lg:col-span-3 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-brand-950 flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-brand-600" /> Biometric enrollment
                </p>
                <Badge variant="brand" size="sm" className="gap-1">
                  <ShieldCheck className="w-3 h-3" /> On-device
                </Badge>
              </div>
              <CardContent className="p-5 sm:p-6 flex-1 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[380px] gap-4">
                <div className={cameraVisible ? "w-full flex justify-center" : "hidden"}>
                  <CameraView videoRef={camera.videoRef} active={camera.isActive} tone={tone} hint={hint} />
                </div>

                {phase === "PREPARING" && !camera.isActive && (
                  <div className="text-center text-slate-600 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-600 shrink-0" /> Loading face models and requesting camera access…
                  </div>
                )}

                {phase === "SCANNING" && (
                  <Button variant="outline" size="sm" onClick={resetCamera} className="text-xs">
                    Cancel
                  </Button>
                )}

                {phase === "LOADING" && (
                  <div className="text-slate-500 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-600" /> Checking enrollment status…
                  </div>
                )}

                {phase === "SUBMITTING" && (
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 rounded-full border-4 border-brand-100 border-t-brand-700 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-brand-950">Verifying with the server…</p>
                  </div>
                )}

                {phase === "INTRO" && (
                  <div className="text-center space-y-4 w-full max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center mx-auto">
                      <ScanFace className="w-9 h-9" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-brand-950">Enroll your face</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        We will capture {ENROLL_SAMPLES} quick samples while you look straight at the camera. This is done once.
                      </p>
                    </div>
                    <Button onClick={startEnrollment} size="lg" variant="accent" className="w-full gap-2">
                      <Camera className="w-4 h-4" /> Start Camera & Enroll
                    </Button>
                  </div>
                )}

                {phase === "DONE" && (
                  <div className="w-full max-w-sm rounded-xl border border-emerald-200 overflow-hidden text-center animate-fadeIn">
                    <div className="px-5 py-5 bg-emerald-50 border-b border-emerald-200 flex justify-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-brand-950">Enrollment completed</h3>
                        <p className="text-xs text-slate-600 mt-1">You can now mark attendance with face verification.</p>
                      </div>
                      <Link href="/student/live-attendance" className="inline-block">
                        <Button size="sm" className="text-xs gap-1.5">
                          Go to Live Attendance <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {phase === "ENROLLED" && (
                  <div className="text-center space-y-4 w-full max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-brand-950">Your face is enrolled</h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Optionally run a quick identity check to confirm recognition works on this device.
                      </p>
                    </div>
                    {testResult && (
                      <div
                        className={`p-3 rounded-lg border text-xs text-left animate-fadeIn ${
                          testResult.matched
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        <p className="font-semibold flex items-center gap-1.5">
                          {testResult.matched ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {testResult.matched ? "Identity matched" : "Identity not matched"} • similarity{" "}
                          {Math.round(testResult.confidence * 100)}%
                        </p>
                        <p className="mt-1 opacity-90">{testResult.reason}</p>
                      </div>
                    )}
                    <Button onClick={runIdentityTest} variant="outline" size="sm" className="text-xs gap-1.5">
                      <ScanFace className="w-3.5 h-3.5" /> Test Identity Check
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status + guidance */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-600" /> Enrollment Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs p-0">
                  <dl className="divide-y divide-slate-100">
                    <div className="flex justify-between items-center gap-4 px-5 py-3">
                      <dt className="text-slate-500">Status</dt>
                      <dd>
                        {status?.enrolled ? (
                          <Badge variant="success" size="sm">Enrolled</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Not enrolled</Badge>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 px-5 py-3">
                      <dt className="text-slate-500">Enrolled on</dt>
                      <dd className="font-semibold text-brand-950 tabular-nums">{status?.enrolledAt ? formatDate(status.enrolledAt) : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 px-5 py-3">
                      <dt className="text-slate-500">Samples</dt>
                      <dd className="font-semibold text-brand-950 tabular-nums">{status?.sampleCount || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 px-5 py-3">
                      <dt className="text-slate-500 shrink-0">Model</dt>
                      <dd className="font-mono text-[10px] text-slate-600 text-right break-all">{status?.modelVersion || "—"}</dd>
                    </div>
                  </dl>
                  {status?.enrolled && (
                    <p className="text-[11px] text-slate-500 px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl leading-relaxed">
                      Need to re-enroll (new glasses, major appearance change)? Ask your administrator to authorize re-enrollment.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tips for a good capture</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-xs text-slate-600">
                    {[
                      "Face a light source; avoid bright windows behind you",
                      "Keep only your face in the frame",
                      "Remove masks or sunglasses",
                      "Hold the device at eye level and look straight ahead",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
