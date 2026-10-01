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

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "danger" | "info" | "neutral" | "purple"; label: string }> = {
  PRESENT: { variant: "success", label: "Present" },
  LATE: { variant: "warning", label: "Late" },
  EXCUSED: { variant: "info", label: "Excused" },
  ABSENT: { variant: "danger", label: "Absent" },
  VERIFYING: { variant: "purple", label: "Verifying…" },
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
    return <p className="text-xs text-slate-500">You are not assigned to any class yet. Ask an administrator to assign you.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {form.mode === "PHYSICAL" && options.locationEnforced && !options.campusConfigured && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Campus location is not configured yet, so students cannot pass the location check for physical sessions. Ask an admin to set it in Campus Settings.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          Class / division
          <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: "" })} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-normal">
            {options.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — Division {c.division} ({c.studentCount} students)
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          Subject
          <select required value={subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-normal">
            {subjects.length === 0 && <option value="">You teach no subject in this class</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["PHYSICAL", "REMOTE"] as const).map((m) => {
          const allowed = options.allowedModes.includes(m);
          return (
            <button
              type="button"
              key={m}
              disabled={!allowed}
              onClick={() => setForm({ ...form, mode: m })}
              className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-40 ${form.mode === m ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                {m === "PHYSICAL" ? <MapPin className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                {m === "PHYSICAL" ? "Physical" : "Remote"}
              </span>
              <span className="text-[11px] text-slate-500">
                {m === "PHYSICAL" ? "Campus location + face + liveness" : "Face + liveness, no location"}
                {!allowed && " (disabled by admin)"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          Duration (min)
          <Input type="number" required min={options.limits.minMinutes} max={options.limits.maxMinutes} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="text-xs" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          Late after (min)
          <Input type="number" required min={0} max={form.durationMinutes} value={form.lateAfterMinutes} onChange={(e) => setForm({ ...form, lateAfterMinutes: Number(e.target.value) })} className="text-xs" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          Room (optional)
          <Input maxLength={60} value={form.room} placeholder="e.g. Lab 302" onChange={(e) => setForm({ ...form, room: e.target.value })} className="text-xs" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.checked })} className="w-4 h-4" />
          Schedule for later
        </label>
        {form.schedule && (
          <Input type="datetime-local" required value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="text-xs w-60" />
        )}
      </div>
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}
      <Button type="submit" disabled={saving || !subjectId} className="w-full text-xs font-bold gap-2" variant="success">
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
      <p className="text-xs text-rose-700 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </p>
    ) : (
      <p className="text-xs text-slate-500 flex items-center gap-2 p-8">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading live session…
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
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex justify-between">
          {flash}
          <button onClick={() => setFlash(null)}>✕</button>
        </div>
      )}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${isLive ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-700/50 text-slate-300 border-slate-600"}`}>
              <Radio className={`w-3.5 h-3.5 ${isLive ? "animate-pulse" : ""}`} />
              {isLive ? "SESSION LIVE" : session.status}
              {isLive && session.mode === "PHYSICAL" && " • CAMPUS CHECK ON"}
            </span>
            <h2 className="text-2xl font-bold tracking-tight">
              {session.subjectName} <span className="text-slate-400 font-normal">• {session.className}{session.division ? ` (${session.division})` : ""}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1">{session.mode === "PHYSICAL" ? <MapPin className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />} {session.mode}</span>
              {session.room && <span>• {session.room}</span>}
              <span>• {formatTime(session.startTime)} – {formatTime(session.endTime)}</span>
              <span>• late after {formatTime(new Date(lateAt))}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLive && (
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Time remaining</p>
                <p className="font-mono text-3xl font-extrabold">{fmtDuration(end - now)}</p>
              </div>
            )}
            {isLive && (
              <Button variant="danger" size="sm" className="text-xs gap-1.5" onClick={() => setConfirmEnd(true)}>
                <Square className="w-3.5 h-3.5" /> End Session
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Present", value: counts.present, icon: CheckCircle2, cls: "text-emerald-700" },
          { label: "Late", value: counts.late, icon: Clock, cls: "text-amber-700" },
          { label: isLive ? "Not yet verified" : "Absent", value: isLive ? counts.notMarked + counts.verifying : counts.absent, icon: XCircle, cls: "text-slate-700" },
          { label: "Verifying now", value: counts.verifying, icon: ScanFace, cls: "text-indigo-700" },
          { label: "Turnout", value: `${attended}/${counts.total}`, icon: Users, cls: "text-slate-900" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase font-semibold text-slate-500 flex items-center gap-1.5">
                <k.icon className="w-3.5 h-3.5" /> {k.label}
              </p>
              <p className={`text-2xl font-extrabold mt-1 ${k.cls}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Class roster</CardTitle>
            <p className="text-xs text-slate-500">
              Updates every 3 seconds{counts.averageConfidence !== null ? ` • average face similarity ${Math.round(counts.averageConfidence * 100)}%` : ""}
              {counts.notEnrolled > 0 ? ` • ${counts.notEnrolled} student(s) have not enrolled their face` : ""}
            </p>
          </CardHeader>
          <CardContent>
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
                      <TableCell>
                        <p className="text-xs font-semibold text-slate-900">{r.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {r.studentId}
                          {!r.faceEnrolled && <span className="ml-1 text-amber-600 font-sans">• face not enrolled</span>}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                        {r.markedAt && <p className="text-[11px] text-slate-400 mt-0.5">{formatTime(r.markedAt)}</p>}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600">
                        {r.verificationMethod ? METHOD_LABEL[r.verificationMethod] ?? r.verificationMethod : r.failedAttempts ? <span className="text-rose-600">{r.failedAttempts} failed attempt(s)</span> : "—"}
                        {r.confidence !== null && <span className="block text-slate-400">similarity {Math.round(r.confidence * 100)}%{r.distanceMeters !== null ? ` • ${r.distanceMeters} m` : ""}</span>}
                        {r.note && <span className="block text-slate-400 italic">{r.note}</span>}
                      </TableCell>
                      <TableCell>
                        {attendedRow ? (
                          <select
                            value={r.participation ?? ""}
                            onChange={(e) => e.target.value !== "" && rate(r.studentId, Number(e.target.value))}
                            className="h-8 px-2 rounded-md border border-slate-200 bg-white text-[11px]"
                          >
                            <option value="">Rate…</option>
                            {PARTICIPATION.map((label, i) => (
                              <option key={label} value={i}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.verificationMethod && r.verificationMethod !== "MANUAL" && r.verificationMethod !== "NOT_VERIFIED" ? (
                          <span className="text-[11px] text-emerald-700 font-semibold">Verified</span>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-[11px] gap-1" onClick={() => setManual(r)}>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Verification events</CardTitle>
            <p className="text-xs text-slate-500">Successful and rejected attempts (no biometric data shown)</p>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto">
            {data.events.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No verification attempts yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.events.map((e) => (
                  <li key={e.id} className={`p-2.5 rounded-lg border text-xs ${e.status === "SUCCEEDED" ? "bg-emerald-50/60 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">{e.studentName}</span>
                      <span className="text-[11px] text-slate-400">{formatTime(e.at)}</span>
                    </div>
                    <p className={e.status === "SUCCEEDED" ? "text-emerald-700" : "text-rose-700"}>
                      {e.status === "SUCCEEDED" ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                      {e.label}
                    </p>
                    {(e.confidence !== null || e.distanceMeters !== null) && (
                      <p className="text-[11px] text-slate-500">
                        {e.confidence !== null ? `similarity ${Math.round(e.confidence * 100)}%` : ""}
                        {e.distanceMeters !== null ? `${e.confidence !== null ? " • " : ""}${e.distanceMeters} m from campus` : ""}
                      </p>
                    )}
                    {e.detail && e.detail !== e.label && <p className="text-[11px] text-slate-500">{e.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!isLive && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="text-xs" onClick={onEnded}>
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
          <select value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs">
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="EXCUSED">Excused</option>
            <option value="ABSENT">Absent</option>
          </select>
          <Input placeholder="Reason (required), e.g. phone camera broken, verified in person" value={manualForm.reason} onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })} className="text-xs" maxLength={200} />
          {manualError && <p className="text-xs text-rose-700">{manualError}</p>}
          <div className="flex justify-end gap-2">
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
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {active.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {active.map((s) => (
                <Button key={s.id} size="sm" variant={selected === s.id ? "primary" : "outline"} className="text-xs" onClick={() => setSelected(s.id)}>
                  {s.subjectName} • {s.className}
                </Button>
              ))}
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-600" /> Start an attendance session
                  </CardTitle>
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
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading your classes…
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Scheduled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcoming.length === 0 ? (
                      <p className="text-xs text-slate-400">No scheduled sessions.</p>
                    ) : (
                      <ul className="space-y-2">
                        {upcoming.map((s) => (
                          <li key={s.id} className="text-xs flex justify-between gap-2">
                            <span className="font-semibold text-slate-800">{s.subjectName} • {s.className}</span>
                            <span className="text-slate-500">{formatDate(s.startTime)} {formatTime(s.startTime)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Recent sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recent.length === 0 ? (
                      <p className="text-xs text-slate-400">No sessions yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {recent.map((s) => (
                          <li key={s.id}>
                            <button onClick={() => setSelected(s.id)} className="w-full text-left text-xs flex justify-between gap-2 p-2 rounded-lg hover:bg-slate-50">
                              <span className="font-semibold text-slate-800">{s.subjectName} • {s.className}</span>
                              <span className="text-slate-500">{formatDate(s.startTime)}</span>
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
