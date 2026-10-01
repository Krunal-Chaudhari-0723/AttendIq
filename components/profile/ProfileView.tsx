"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { User, KeyRound, ScanFace, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Profile {
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  memberSince: string;
  student?: {
    studentId: string;
    rollNumber: string;
    className: string;
    division?: string;
    semester?: number;
    department: string;
    academicYear: string;
    phone: string;
    status: string;
    face: { enrolled: boolean; enrolledAt?: string };
    subjects: { name: string; code: string; teacher: string | null }[];
  } | null;
  teacher?: {
    teacherId: string;
    department: string;
    designation: string;
    phone: string;
    status: string;
    classes: { name: string; division: string; semester: number }[];
    subjects: { name: string; code: string; className: string }[];
  } | null;
}

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase font-semibold text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-900 mt-0.5">{value || "—"}</p>
  </div>
);

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    setSaving(true);
    const res = await apiFetch("/profile/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    setSaving(false);
    if (res.success) {
      setMsg({ ok: true, text: "Password changed." });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } else setMsg({ ok: false, text: res.error || "Could not change password." });
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-600" /> Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Input type="password" autoComplete="current-password" required placeholder="Current password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="text-xs" />
          <Input type="password" autoComplete="new-password" required minLength={8} placeholder="New password (8+ characters, letters and numbers)" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="text-xs" />
          <Input type="password" autoComplete="new-password" required placeholder="Confirm new password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="text-xs" />
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
          <Button type="submit" size="sm" disabled={saving} className="text-xs">
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PhoneEditor({ initial }: { initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    const res = await apiFetch("/profile", { method: "PATCH", body: JSON.stringify({ phone }) });
    setMsg(res.success ? { ok: true, text: "Saved." } : { ok: false, text: res.error || "Could not save." });
  };
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase font-semibold text-slate-400">Phone</p>
      <div className="flex gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="text-xs h-9" maxLength={20} />
        <Button size="sm" variant="outline" className="text-xs h-9" onClick={save}>
          Save
        </Button>
      </div>
      {msg && <p className={`text-[11px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
    </div>
  );
}

/** Profile for the signed-in user of any role. */
export function ProfileView() {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Profile>("/profile").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error || "Could not load your profile.");
    });
  }, []);

  if (error)
    return (
      <p className="text-xs text-rose-700 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </p>
    );
  if (!data) return <p className="text-xs text-slate-500">Loading profile…</p>;

  const s = data.student;
  const t = data.teacher;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-bold flex items-center justify-center shrink-0">{data.name.charAt(0)}</div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">{data.name}</h2>
              <p className="text-xs text-slate-500">{data.email}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="purple" size="sm">{data.role}</Badge>
                {s && <Badge variant={s.status === "ACTIVE" ? "success" : "warning"} size="sm">{s.status}</Badge>}
                {t && <Badge variant={t.status === "ACTIVE" ? "success" : "warning"} size="sm">{t.status}</Badge>}
                <span className="text-[11px] text-slate-400">Member since {formatDate(data.memberSince)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {s && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" /> Academic details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Field label="Student ID" value={s.studentId} />
              <Field label="Roll number" value={s.rollNumber} />
              <Field label="Class" value={`${s.className}${s.division ? ` (Div ${s.division})` : ""}`} />
              <Field label="Semester" value={s.semester} />
              <Field label="Department" value={s.department} />
              <Field label="Academic year" value={s.academicYear} />
              <div className="col-span-2 md:col-span-3">
                <PhoneEditor initial={s.phone} />
              </div>
            </CardContent>
          </Card>
        )}
        {t && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" /> Faculty details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <Field label="Teacher ID" value={t.teacherId} />
              <Field label="Designation" value={t.designation} />
              <Field label="Department" value={t.department} />
              <div className="col-span-2 md:col-span-3">
                <PhoneEditor initial={t.phone} />
              </div>
            </CardContent>
          </Card>
        )}
        {(s?.subjects.length || t?.subjects.length) ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" /> {s ? "My subjects" : "Classes & subjects"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-100 text-xs">
                {s?.subjects.map((x) => (
                  <li key={x.code} className="py-2 flex justify-between">
                    <span className="font-semibold text-slate-800">
                      {x.name} <span className="text-slate-400 font-normal">{x.code}</span>
                    </span>
                    <span className="text-slate-500">{x.teacher ?? "—"}</span>
                  </li>
                ))}
                {t?.subjects.map((x) => (
                  <li key={x.code} className="py-2 flex justify-between">
                    <span className="font-semibold text-slate-800">
                      {x.name} <span className="text-slate-400 font-normal">{x.code}</span>
                    </span>
                    <span className="text-slate-500">{x.className}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <p className="text-[11px] text-slate-400">Name, email, IDs and class assignments are managed by your administrator.</p>
      </div>

      <div className="space-y-6">
        {s && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-indigo-600" /> Face enrollment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {s.face.enrolled ? (
                <p className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Enrolled on {formatDate(s.face.enrolledAt)}
                </p>
              ) : (
                <>
                  <p className="text-amber-700 font-semibold">Not enrolled — required for attendance.</p>
                  <Link href="/student/face-enrollment">
                    <Button size="sm" className="text-xs">
                      Enroll now
                    </Button>
                  </Link>
                </>
              )}
              <p className="text-slate-400">Your face data is encrypted and never shown to anyone.</p>
            </CardContent>
          </Card>
        )}
        <PasswordCard />
      </div>
    </div>
  );
}
