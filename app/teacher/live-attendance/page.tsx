"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Radio,
  Play,
  Square,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  MapPin,
  Wifi,
  RefreshCw,
  ScanFace,
  Loader2,
  PencilLine,
  CalendarClock,
} from "lucide-react";

interface Options {
  classes: { id: string; name: string; code: string; division: string; studentCount: number }[];
  subjects: { id: string; name: string; code: string; classId: string }[];
  allowedModes: ("PHYSICAL" | "REMOTE")[];
  campusConfigured: boolean;
  locationEnforced: boolean;
  limits: { defaultMinutes: number; minMinutes: number; maxMinutes: number; defaultLateAfterMinutes: number };
}

interface SessionSummary {
  id: string;
  className: string;
  division?: string;
  subjectName: string;
  mode: "PHYSICAL" | "REMOTE";
  room?: string;
  status: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes: number;
}

interface RosterRow {
  studentId: string;
  name: string;
  rollNumber: string;
  faceEnrolled: boolean;
  status: string;
  markedAt: string | null;
  verificationMethod: string | null;
  confidence: number | null;
  distanceMeters: number | null;
  note: string | null;
  failedAttempts: number;
  participation: number | null;
}

interface LiveData {
  session: SessionSummary;
  serverTime: string;
  counts: {
    total: number;
    present: number;
    late: number;
    excused: number;
    absent: number;
    verifying: number;
    notMarked: number;
    notEnrolled: number;
    averageConfidence: number | null;
  };
  roster: RosterRow[];
  events: { id: string; studentId: string; studentName: string; status: string; code: string | null; label: string; detail: string | null; confidence: number | null; distanceMeters: number | null; at: string }[];
}

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "danger" | "info" | "neutral" | "brand"; label: string }> = {
  PRESENT: { variant: "success", label: "Present" },
  LATE: { variant: "warning", label: "Late" },
  EXCUSED: { variant: "info", label: "Excused" },
  ABSENT: { variant: "danger", label: "Absent" },
  VERIFYING: { variant: "brand", label: "Verifying…" },
  NOT_MARKED: { variant: "neutral", label: "Not marked" },
};

const METHOD_LABEL: Record<string, string> = {
  FACE_AND_LOCATION: "Face + liveness + location",
  FACE_ONLY: "Face + liveness",
  REMOTE_FACE: "Remote: face + liveness",
  MANUAL: "Manual (teacher)",
  NOT_VERIFIED: "Not verified",
};

const PARTICIPATION = ["None", "Low", "Good", "Excellent"];

const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const fmtDuration = (ms: number) => {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function StartSessionForm({ options, onStarted }: { options: Options; onStarted: (id: string) => void }) {
  const [form, setForm] = useState({
    classId: options.classes[0]?.id ?? "",
    subjectId: "",
    mode: options.allowedModes[0] ?? "PHYSICAL",
    durationMinutes: options.limits.defaultMinutes,
    lateAfterMinutes: options.limits.defaultLateAfterMinutes,
    room: "",
    schedule: false,
    startAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const subjects = options.subjects.filter((s) => s.classId === form.classId);
  const subjectId = subjects.some((s) => s.id === form.subjectId) ? form.subjectId : subjects[0]?.id ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await apiFetch<SessionSummary>("/teacher/sessions", {
      method: "POST",
      body: JSON.stringify({
        classId: form.classId,
        subjectId,
        mode: form.mode,
        durationMinutes: Number(form.durationMinutes),
        lateAfterMinutes: Number(form.lateAfterMinutes),
        room: form.room || undefined,
        startAt: form.schedule && form.startAt ? new Date(form.startAt).toISOString() : undefined,
      }),
    });
    setSaving(false);
    if (res.success && res.data) onStarted(res.data.id);
    else setError(res.error || "Could not start the session.");
  };

  if (options.classes.length === 0) {
    return <p className="text-xs text-slate-500 p-4 rounded-lg bg-slate-50 border border-slate-200">You are not assigned to any class yet. Ask an administrator to assign you.</p>;
  }

  const selectCls =
    "w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15";

  return (
    <form onSubmit={submit} className="space-y-5">
      {form.mode === "PHYSICAL" && options.locationEnforced && !options.campusConfigured && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Campus location is not configured yet, so students cannot pass the location check for physical sessions. Ask an admin to set it in Campus Settings.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          Class / division
          <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: "" })} className={selectCls}>
            {options.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — Division {c.division} ({c.studentCount} students)
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          Subject
          <select required value={subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className={selectCls}>
            {subjects.length === 0 && <option value="">You teach no subject in this class</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-1.5 border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold text-slate-700">Verification mode</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["PHYSICAL", "REMOTE"] as const).map((m) => {
            const allowed = options.allowedModes.includes(m);
            return (
              <button
                type="button"
                key={m}
                disabled={!allowed}
                onClick={() => setForm({ ...form, mode: m })}
                className={`relative flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${form.mode === m ? "border-brand-600 bg-brand-50/70 ring-3 ring-brand-500/10" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${form.mode === m ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {m === "PHYSICAL" ? <MapPin className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-brand-950">{m === "PHYSICAL" ? "Physical" : "Remote"}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">
                    {m === "PHYSICAL" ? "Campus location + face + liveness" : "Face + liveness, no location"}
                    {!allowed && " (disabled by admin)"}
                  </span>
                </span>
                {form.mode === m && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          Duration (min)
          <Input type="number" required min={options.limits.minMinutes} max={options.limits.maxMinutes} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="font-normal" />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          Late after (min)
          <Input type="number" required min={0} max={form.durationMinutes} value={form.lateAfterMinutes} onChange={(e) => setForm({ ...form, lateAfterMinutes: Number(e.target.value) })} className="font-normal" />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          Room (optional)
          <Input maxLength={60} value={form.room} placeholder="e.g. Lab 302" onChange={(e) => setForm({ ...form, room: e.target.value })} className="font-normal" />
        </label>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.checked })} className="w-4 h-4 accent-brand-700" />
          Schedule for later
        </label>
        {form.schedule && (
          <Input type="datetime-local" required value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full sm:w-60" />
        )}
      </div>
      {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>}
      <Button type="submit" disabled={saving || !subjectId} className="w-full" size="lg" variant="accent">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : form.schedule ? <CalendarClock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {form.schedule ? "Schedule session" : "Start attendance session now"}
      </Button>
    </form>
  );
}

function LiveMonitor({ sessionId, onEnded }: { sessionId: string; onEnded: () => void }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [manual, setManual] = useState<RosterRow | null>(null);
  const [manualForm, setManualForm] = useState({ status: "PRESENT", reason: "" });
  const [manualError, setManualError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    const res = await apiFetch<LiveData>(`/teacher/sessions/${sessionId}/live`);
    if (res.success && res.data) {
      setData(res.data);
      setError(null);
    } else setError(res.error || "Could not load the live session.");
  }, [sessionId]);

  // Poll every 3 s while the tab is visible
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (!document.hidden) await load();
      if (!stopped) timer = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load]);

  const endSession = async () => {
    setEnding(true);
    const res = await apiFetch<{ absentCount: number }>(`/teacher/sessions/${sessionId}/end`, { method: "POST" });
    setEnding(false);
    setConfirmEnd(false);
    if (res.success) {
      setFlash(res.message || "Session ended.");
      await load();
    } else setError(res.error || "Could not end the session.");
  };

  const saveManual = async () => {
    if (!manual) return;
    setManualError(null);
    const res = await apiFetch(`/teacher/sessions/${sessionId}/manual`, {
      method: "POST",
      body: JSON.stringify({ studentId: manual.studentId, ...manualForm }),
    });
    if (res.success) {
      setManual(null);
      setManualForm({ status: "PRESENT", reason: "" });
      setFlash(res.message || "Updated.");
      load();
    } else setManualError(res.error || "Could not update.");
  };

  const rate = async (studentId: string, rating: number) => {
    const res = await apiFetch(`/teacher/sessions/${sessionId}/participation`, { method: "PUT", body: JSON.stringify({ ratings: [{ studentId, rating }] }) });
    if (!res.success) setError(res.error || "Could not save participation.");
    else load();
  };

  if (!data) {
    return error ? (
      <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
      </p>
    ) : (
      <p className="text-xs text-slate-500 flex items-center justify-center gap-2 p-10 rounded-xl border border-slate-200 bg-white">
        <RefreshCw className="w-4 h-4 animate-spin text-brand-600" /> Loading live session…
      </p>
    );
  }

  const { session, counts } = data;
  const isLive = session.status === "ACTIVE";
  const end = new Date(session.endTime).getTime();
  const start = new Date(session.startTime).getTime();
  const lateAt = start + session.lateAfterMinutes * 60_000;
  const attended = counts.present + counts.late;

  return (
    <div className="space-y-6">
      {flash && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {flash}
          </span>
          <button onClick={() => setFlash(null)} className="text-emerald-700 hover:text-emerald-900 px-1">✕</button>
        </div>
      )}
      {error && (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="rounded-xl bg-brand-900 text-white p-5 sm:p-6 border border-brand-800 relative overflow-hidden">
        <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" aria-hidden="true" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-3 min-w-0">
            <span
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider border ${
                isLive ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 text-brand-100 border-white/15"
              }`}
            >
              {isLive ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              ) : (
                <Radio className="w-3.5 h-3.5" />
              )}
              {isLive ? "SESSION LIVE" : session.status}
              {isLive && session.mode === "PHYSICAL" && " • CAMPUS CHECK ON"}
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight leading-snug">
              {session.subjectName} <span className="text-brand-100/70 font-normal">• {session.className}{session.division ? ` (${session.division})` : ""}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-brand-100/80">
              <span className="flex items-center gap-1.5">{session.mode === "PHYSICAL" ? <MapPin className="w-3.5 h-3.5 text-accent-300" /> : <Wifi className="w-3.5 h-3.5 text-accent-300" />} {session.mode}</span>
              {session.room && <span>• {session.room}</span>}
              <span className="tabular-nums">• {formatTime(session.startTime)} – {formatTime(session.endTime)}</span>
              <span className="tabular-nums">• late after {formatTime(new Date(lateAt))}</span>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-4 lg:gap-5 shrink-0">
            {isLive && (
              <div className="lg:text-right rounded-lg bg-white/5 border border-white/10 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wider text-brand-100/70 font-semibold">Time remaining</p>
                <p className="font-mono text-3xl font-semibold tabular-nums leading-tight">{fmtDuration(end - now)}</p>
              </div>
            )}
            {isLive && (
              <Button variant="danger" size="md" onClick={() => setConfirmEnd(true)}>
                <Square className="w-3.5 h-3.5" /> End Session
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Present", value: counts.present, icon: CheckCircle2, cls: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700" },
          { label: "Late", value: counts.late, icon: Clock, cls: "text-amber-700", chip: "bg-amber-50 text-amber-700" },
          { label: isLive ? "Not yet verified" : "Absent", value: isLive ? counts.notMarked + counts.verifying : counts.absent, icon: XCircle, cls: isLive ? "text-slate-700" : "text-rose-700", chip: isLive ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700" },
          { label: "Verifying now", value: counts.verifying, icon: ScanFace, cls: "text-brand-700", chip: "bg-brand-50 text-brand-700" },
          { label: "Turnout", value: `${attended}/${counts.total}`, icon: Users, cls: "text-brand-950", chip: "bg-accent-50 text-accent-600" },
        ].map((k) => (
          <Card key={k.label} className={k.label === "Turnout" ? "col-span-2 sm:col-span-1" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow truncate">{k.label}</p>
                <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${k.chip}`}>
                  <k.icon className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className={`text-3xl font-semibold mt-1 tabular-nums tracking-tight ${k.cls}`}>{k.value}</p>
              {k.label === "Turnout" && (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${counts.total ? Math.round((attended / counts.total) * 100) : 0}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <Card className="xl:col-span-2 min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Class roster</CardTitle>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Updates every 3 seconds{counts.averageConfidence !== null ? ` • average face similarity ${Math.round(counts.averageConfidence * 100)}%` : ""}
              {counts.notEnrolled > 0 ? ` • ${counts.notEnrolled} student(s) have not enrolled their face` : ""}
            </p>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Participation</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.roster.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.NOT_MARKED;
                  const attendedRow = r.status === "PRESENT" || r.status === "LATE";
                  return (
                    <TableRow key={r.studentId}>
                      <TableCell className="py-3">
                        <p className="text-sm font-semibold text-brand-950 whitespace-nowrap">{r.name}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                          {r.studentId}
                          {!r.faceEnrolled && <span className="ml-1 text-amber-700 font-medium">• face not enrolled</span>}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} size="md">{badge.label}</Badge>
                        {r.markedAt && <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{formatTime(r.markedAt)}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 min-w-40">
                        {r.verificationMethod ? METHOD_LABEL[r.verificationMethod] ?? r.verificationMethod : r.failedAttempts ? <span className="text-rose-700 font-medium">{r.failedAttempts} failed attempt(s)</span> : "—"}
                        {r.confidence !== null && <span className="block text-[11px] text-slate-500 tabular-nums">similarity {Math.round(r.confidence * 100)}%{r.distanceMeters !== null ? ` • ${r.distanceMeters} m` : ""}</span>}
                        {r.note && <span className="block text-[11px] text-slate-500 italic">{r.note}</span>}
                      </TableCell>
                      <TableCell>
                        {attendedRow ? (
                          <select
                            value={r.participation ?? ""}
                            onChange={(e) => e.target.value !== "" && rate(r.studentId, Number(e.target.value))}
                            className="h-8 px-2 rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                          >
                            <option value="">Rate…</option>
                            {PARTICIPATION.map((label, i) => (
                              <option key={label} value={i}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.verificationMethod && r.verificationMethod !== "MANUAL" && r.verificationMethod !== "NOT_VERIFIED" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setManual(r)}>
                            <PencilLine className="w-3.5 h-3.5" /> Manual
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Verification events</CardTitle>
            <p className="text-xs text-slate-500">Successful and rejected attempts (no biometric data shown)</p>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto p-3 sm:p-4">
            {data.events.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                <ScanFace className="w-5 h-5 mx-auto mb-2 text-brand-400" />
                No verification attempts yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.events.map((e) => (
                  <li
                    key={e.id}
                    className={`pl-3 pr-3 py-2.5 rounded-lg border border-l-[3px] text-xs bg-white ${
                      e.status === "SUCCEEDED" ? "border-slate-200 border-l-emerald-500" : "border-slate-200 border-l-rose-500 bg-rose-50/40"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-brand-950">{e.studentName}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{formatTime(e.at)}</span>
                    </div>
                    <p className={`mt-0.5 font-medium ${e.status === "SUCCEEDED" ? "text-emerald-700" : "text-rose-700"}`}>
                      {e.status === "SUCCEEDED" ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> : <XCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                      {e.label}
                    </p>
                    {(e.confidence !== null || e.distanceMeters !== null) && (
                      <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                        {e.confidence !== null ? `similarity ${Math.round(e.confidence * 100)}%` : ""}
                        {e.distanceMeters !== null ? `${e.confidence !== null ? " • " : ""}${e.distanceMeters} m from campus` : ""}
                      </p>
                    )}
                    {e.detail && e.detail !== e.label && <p className="text-[11px] text-slate-500 mt-0.5">{e.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!isLive && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onEnded}>
            Back to sessions
          </Button>
        </div>
      )}

      <Modal isOpen={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this session?" subtitle={`${counts.notMarked + counts.verifying} student(s) without a verified record will be marked absent.`} maxWidth="sm">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmEnd(false)}>
            Keep running
          </Button>
          <Button variant="danger" size="sm" disabled={ending} onClick={endSession}>
            {ending ? "Ending…" : "End session"}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(manual)} onClose={() => setManual(null)} title={`Manual attendance: ${manual?.name ?? ""}`} subtitle="Recorded as a manual teacher entry with your reason — not as a verified check-in." maxWidth="sm">
        <div className="space-y-3">
          <select value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })} className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15">
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="EXCUSED">Excused</option>
            <option value="ABSENT">Absent</option>
          </select>
          <Input placeholder="Reason (required), e.g. phone camera broken, verified in person" value={manualForm.reason} onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })} maxLength={200} />
          {manualError && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2">{manualError}</p>}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setManual(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={manualForm.reason.trim().length < 5} onClick={saveManual}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function TeacherLiveAttendancePage() {
  const [options, setOptions] = useState<Options | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([apiFetch<Options>("/teacher/sessions/options"), apiFetch<{ sessions: SessionSummary[] }>("/teacher/sessions?limit=15")]).then(([o, s]) => {
      if (o.success && o.data) setOptions(o.data);
      else setError(o.error || "Could not load session options.");
      if (s.success && s.data) {
        setSessions(s.data.sessions);
        const active = s.data.sessions.find((x) => x.status === "ACTIVE");
        setSelected((cur) => cur ?? active?.id ?? null);
      }
    });
  }, [reloadKey]);

  const active = useMemo(() => (sessions ?? []).filter((s) => s.status === "ACTIVE"), [sessions]);
  const upcoming = useMemo(() => (sessions ?? []).filter((s) => s.status === "SCHEDULED"), [sessions]);
  const recent = useMemo(() => (sessions ?? []).filter((s) => s.status === "COMPLETED" || s.status === "CANCELLED").slice(0, 6), [sessions]);

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Live Attendance" subtitle="Start attendance sessions and watch verifications arrive in real time" defaultRole="TEACHER">
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {active.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
              <span className="eyebrow">Live sessions</span>
              <div className="flex flex-wrap gap-2">
                {active.map((s) => (
                  <Button key={s.id} size="sm" variant={selected === s.id ? "primary" : "outline"} onClick={() => setSelected(s.id)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    {s.subjectName} • {s.className}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selected ? (
            <LiveMonitor
              key={selected}
              sessionId={selected}
              onEnded={() => {
                setSelected(null);
                setReloadKey((k) => k + 1);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-start">
              <Card className="lg:col-span-3 border-t-[3px] border-t-accent-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center shrink-0">
                      <Play className="w-3.5 h-3.5" />
                    </span>
                    Start an attendance session
                  </CardTitle>
                  <p className="text-xs text-slate-500">Choose the class, subject and verification mode. Students check in from their own device.</p>
                </CardHeader>
                <CardContent>
                  {options ? (
                    <StartSessionForm
                      options={options}
                      onStarted={(id) => {
                        setSelected(id);
                        setReloadKey((k) => k + 1);
                      }}
                    />
                  ) : (
                    <p className="text-xs text-slate-500 flex items-center gap-2 py-6 justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-600" /> Loading your classes…
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                    <CalendarClock className="w-4 h-4 text-brand-600" />
                    <CardTitle>Scheduled</CardTitle>
                  </CardHeader>
                  <CardContent className={upcoming.length === 0 ? "" : "p-0"}>
                    {upcoming.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">No scheduled sessions.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {upcoming.map((s) => (
                          <li key={s.id} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-5 py-3">
                            <span className="font-semibold text-brand-950">{s.subjectName} • {s.className}</span>
                            <span className="text-slate-500 tabular-nums whitespace-nowrap">{formatDate(s.startTime)} {formatTime(s.startTime)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                    <Clock className="w-4 h-4 text-brand-600" />
                    <CardTitle>Recent sessions</CardTitle>
                  </CardHeader>
                  <CardContent className={recent.length === 0 ? "" : "p-2"}>
                    {recent.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">No sessions yet.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {recent.map((s) => (
                          <li key={s.id}>
                            <button onClick={() => setSelected(s.id)} className="group w-full text-left text-xs flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-50/60 transition-colors">
                              <span className="font-semibold text-brand-950 group-hover:text-brand-800">{s.subjectName} • {s.className}</span>
                              <span className="text-slate-500 tabular-nums whitespace-nowrap">{formatDate(s.startTime)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
