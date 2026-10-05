"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationList } from "@/components/notifications/NotificationList";
import { apiFetch } from "@/lib/api";
import { Megaphone } from "lucide-react";

export default function AdminNotificationsPage() {
  const [form, setForm] = useState({ title: "", message: "", recipientRole: "ALL" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    const res = await apiFetch("/admin/notifications", { method: "POST", body: JSON.stringify(form) });
    setSending(false);
    if (res.success) {
      setMsg({ ok: true, text: "Announcement sent." });
      setForm({ title: "", message: "", recipientRole: form.recipientRole });
      setReloadKey((k) => k + 1);
    } else setMsg({ ok: false, text: res.error || "Could not send the announcement." });
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell title="Notifications" subtitle="Send announcements and review system notifications" defaultRole="ADMIN">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-start">
          <Card className="lg:col-span-2 h-fit">
            <CardHeader>
              <p className="eyebrow text-brand-600">University announcements</p>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-brand-600" /> New announcement
              </CardTitle>
              <CardDescription>Delivered to the selected audience&apos;s notification inbox.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={send} className="space-y-4">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  Audience
                  <select value={form.recipientRole} onChange={(e) => setForm({ ...form, recipientRole: e.target.value })} className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15">
                    <option value="ALL">Everyone</option>
                    <option value="STUDENT">All students</option>
                    <option value="TEACHER">All teachers</option>
                    <option value="ADMIN">Administrators</option>
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  Title
                  <Input required minLength={3} maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-sm font-normal" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  Message
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                  />
                </label>
                {msg && (
                  <p
                    className={`p-3 rounded-lg border text-xs font-medium animate-fadeIn ${
                      msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    {msg.text}
                  </p>
                )}
                <div className="border-t border-slate-100 pt-4">
                  <Button type="submit" disabled={sending} className="w-full text-xs gap-1.5">
                    <Megaphone className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send announcement"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <div className="lg:col-span-3 min-w-0">
            <NotificationList reloadKey={reloadKey} />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
