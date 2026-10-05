"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProfileView } from "@/components/profile/ProfileView";
import { apiFetch } from "@/lib/api";
import { Clock, MapPin, ScanFace, Activity, Sparkles, Database, ArrowRight, AlertTriangle } from "lucide-react";

interface AdminSettings {
  attendance: { defaultSessionMinutes: number; defaultLateAfterMinutes: number; minSessionMinutes: number; maxSessionMinutes: number; attemptTtlSeconds: number; auditRetentionDays: number };
  campus: { name: string; configured: boolean; enforced: boolean; radiusMeters: number; maxAccuracyMeters: number; allowedModes: string[] } | null;
  verification: { faceModel: string; matchThreshold: number; livenessTurnThreshold: number; livenessCenterThreshold: number };
  analytics: { engagementWeights: Record<string, number>; engagementWindowDays: number; attendanceRequirementPercent: number; riskLevels: { high: { minPoints: number }; medium: { minPoints: number } } };
  ai: { configured: boolean; model: string | null };
  system: { environment: string; database: string; databaseName: string | null };
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center gap-4 py-2 text-xs border-b border-slate-100 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-brand-950 text-right break-words min-w-0">{value}</span>
  </div>
);

export default function AdminSettingsPage() {
  const [data, setData] = useState<AdminSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ defaultSessionMinutes: 60, defaultLateAfterMinutes: 15 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<AdminSettings>("/admin/settings").then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setForm({ defaultSessionMinutes: res.data.attendance.defaultSessionMinutes, defaultLateAfterMinutes: res.data.attendance.defaultLateAfterMinutes });
      } else setError(res.error || "Could not load settings.");
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch("/admin/settings/attendance", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    setMsg(res.success ? { ok: true, text: "Attendance defaults saved. New sessions will use them." } : { ok: false, text: res.error || "Could not save." });
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell title="Settings" subtitle="Your admin profile, attendance defaults and the system's effective configuration" defaultRole="ADMIN">
        <div className="space-y-6">
          <ProfileView />

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {data && (
            <section className="space-y-3">
            <p className="eyebrow text-brand-600">System configuration</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-600" /> Attendance defaults
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={save} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                        Default session length (min)
                        <Input type="number" required min={data.attendance.minSessionMinutes} max={data.attendance.maxSessionMinutes} value={form.defaultSessionMinutes} onChange={(e) => setForm({ ...form, defaultSessionMinutes: Number(e.target.value) })} className="text-sm font-normal" />
                      </label>
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                        Mark late after (min)
                        <Input type="number" required min={0} max={form.defaultSessionMinutes} value={form.defaultLateAfterMinutes} onChange={(e) => setForm({ ...form, defaultLateAfterMinutes: Number(e.target.value) })} className="text-sm font-normal" />
                      </label>
                    </div>
                    {msg && (
                      <p
                        className={`p-3 rounded-lg border text-xs font-medium animate-fadeIn ${
                          msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        {msg.text}
                      </p>
                    )}
                    <Button type="submit" size="sm" disabled={saving} className="text-xs">
                      {saving ? "Saving…" : "Save defaults"}
                    </Button>
                  </form>
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <Row label="Verification attempt expires after" value={`${data.attendance.attemptTtlSeconds / 60} min`} />
                    <Row label="Verification audit log kept for" value={`${data.attendance.auditRetentionDays} days`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-600" /> Campus location
                  </CardTitle>
                  <Link href="/admin/campus-settings">
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      Configure <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {data.campus ? (
                    <>
                      <Row label="Campus" value={data.campus.name} />
                      <Row label="Status" value={data.campus.configured ? <Badge variant="success" size="sm">Configured</Badge> : <Badge variant="warning" size="sm">Not configured</Badge>} />
                      <Row label="Location check" value={data.campus.enforced ? "Enforced for physical sessions" : "Disabled"} />
                      <Row label="Allowed radius" value={`${data.campus.radiusMeters} m`} />
                      <Row label="Max location inaccuracy" value={`±${data.campus.maxAccuracyMeters} m`} />
                      <Row label="Attendance modes" value={data.campus.allowedModes.join(", ")} />
                    </>
                  ) : (
                    <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">Campus not configured yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-brand-600" /> Identity verification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Face model" value={<span className="font-mono text-[10px]">{data.verification.faceModel}</span>} />
                  <Row label="Match threshold (distance ≤)" value={data.verification.matchThreshold} />
                  <Row label="Liveness: head-turn threshold" value={data.verification.livenessTurnThreshold} />
                  <Row label="Liveness: facing-camera tolerance" value={data.verification.livenessCenterThreshold} />
                  <p className="text-[11px] text-slate-500 pt-3 leading-snug">Security thresholds are set on the server (environment variables), not from the browser.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-600" /> Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row
                    label="Engagement weights"
                    value={Object.entries(data.analytics.engagementWeights)
                      .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                      .join(" • ")}
                  />
                  <Row label="Engagement window" value={`${data.analytics.engagementWindowDays} days`} />
                  <Row label="Attendance requirement" value={`${data.analytics.attendanceRequirementPercent}%`} />
                  <Row label="Risk levels" value={`High ≥ ${data.analytics.riskLevels.high.minPoints} pts • Medium ≥ ${data.analytics.riskLevels.medium.minPoints} pts`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-600" /> AI recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Status" value={data.ai.configured ? <Badge variant="success" size="sm">Enabled</Badge> : <Badge variant="neutral" size="sm">Not configured — rule-based only</Badge>} />
                  {data.ai.model && <Row label="Model" value={data.ai.model} />}
                  <p className="text-[11px] text-slate-500 pt-3 leading-snug">Set ANTHROPIC_API_KEY or GEMINI_API_KEY on the server to enable AI generation. Without it the rule engine is used and labelled as such.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-brand-600" /> System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Environment" value={data.system.environment} />
                  <Row label="Database" value={<Badge variant={data.system.database === "connected" ? "success" : "danger"} size="sm">{data.system.database}</Badge>} />
                  {data.system.databaseName && <Row label="Database name" value={data.system.databaseName} />}
                </CardContent>
              </Card>
            </div>
            </section>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
