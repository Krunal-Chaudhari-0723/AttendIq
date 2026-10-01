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
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Privacy notice */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-start gap-3 shadow-md">
            <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">How your face data is handled</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your camera image is processed on this device and is never uploaded or stored. Only a 128-number face
                signature is sent, encrypted at rest, and used solely to confirm your identity when you mark attendance.
                It is never shown to teachers, admins or other students.
              </p>
            </div>
          </div>

          {(error || cameraError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError || error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Camera surface */}
            <Card className="lg:col-span-3 overflow-hidden bg-slate-950 border-slate-800">
              <CardContent className="p-6 h-full flex flex-col items-center justify-center min-h-[380px] gap-4">
                <div className={cameraVisible ? "w-full flex justify-center" : "hidden"}>
                  <CameraView videoRef={camera.videoRef} active={camera.isActive} tone={tone} hint={hint} />
                </div>

                {phase === "PREPARING" && !camera.isActive && (
                  <div className="text-center text-slate-300 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Loading face models and requesting camera access…
                  </div>
                )}

                {phase === "SCANNING" && (
                  <Button variant="outline" size="sm" onClick={resetCamera} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs">
                    Cancel
                  </Button>
                )}

                {phase === "LOADING" && (
                  <div className="text-slate-400 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Checking enrollment status…
                  </div>
                )}

                {phase === "SUBMITTING" && (
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-white">Verifying with the server…</p>
                  </div>
                )}

                {phase === "INTRO" && (
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto">
                      <ScanFace className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Enroll your face</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        We will capture {ENROLL_SAMPLES} quick samples while you look straight at the camera. This is done once.
                      </p>
                    </div>
                    <Button onClick={startEnrollment} size="lg" className="w-full text-xs font-bold py-3 gap-2">
                      <Camera className="w-4 h-4" /> Start Camera & Enroll
                    </Button>
                  </div>
                )}

                {phase === "DONE" && (
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Enrollment completed</h3>
                      <p className="text-xs text-slate-400 mt-1">You can now mark attendance with face verification.</p>
                    </div>
                    <Link href="/student/live-attendance">
                      <Button size="sm" className="text-xs gap-1.5">
                        Go to Live Attendance <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}

                {phase === "ENROLLED" && (
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Your face is enrolled</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Optionally run a quick identity check to confirm recognition works on this device.
                      </p>
                    </div>
                    {testResult && (
                      <div
                        className={`p-3 rounded-lg border text-xs text-left ${
                          testResult.matched
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        <p className="font-bold flex items-center gap-1.5">
                          {testResult.matched ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {testResult.matched ? "Identity matched" : "Identity not matched"} • similarity{" "}
                          {Math.round(testResult.confidence * 100)}%
                        </p>
                        <p className="mt-1 opacity-90">{testResult.reason}</p>
                      </div>
                    )}
                    <Button
                      onClick={runIdentityTest}
                      variant="outline"
                      size="sm"
                      className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                    >
                      <ScanFace className="w-3.5 h-3.5" /> Test Identity Check
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status + guidance */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-indigo-600" /> Enrollment Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status</span>
                    {status?.enrolled ? (
                      <Badge variant="success" size="sm">Enrolled</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Not enrolled</Badge>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Enrolled on</span>
                    <span className="font-semibold text-slate-800">{status?.enrolledAt ? formatDate(status.enrolledAt) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Samples</span>
                    <span className="font-semibold text-slate-800">{status?.sampleCount || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 shrink-0">Model</span>
                    <span className="font-mono text-[10px] text-slate-600 text-right break-all">{status?.modelVersion || "—"}</span>
                  </div>
                  {status?.enrolled && (
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      Need to re-enroll (new glasses, major appearance change)? Ask your administrator to authorize re-enrollment.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Tips for a good capture</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {[
                      "Face a light source; avoid bright windows behind you",
                      "Keep only your face in the frame",
                      "Remove masks or sunglasses",
                      "Hold the device at eye level and look straight ahead",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
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
