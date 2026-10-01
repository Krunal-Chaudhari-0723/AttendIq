"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-2 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-600" /> New announcement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={send} className="space-y-3">
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Audience
                  <select value={form.recipientRole} onChange={(e) => setForm({ ...form, recipientRole: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-normal">
                    <option value="ALL">Everyone</option>
                    <option value="STUDENT">All students</option>
                    <option value="TEACHER">All teachers</option>
                    <option value="ADMIN">Administrators</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Title
                  <Input required minLength={3} maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-xs" />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-slate-700">
                  Message
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
                <Button type="submit" disabled={sending} className="w-full text-xs gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send announcement"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="lg:col-span-3">
            <NotificationList reloadKey={reloadKey} />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
