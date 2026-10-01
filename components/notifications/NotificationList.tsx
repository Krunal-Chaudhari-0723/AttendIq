"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { Bell, CheckCheck, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationsPath = (role: string) =>
  role === "ADMIN" ? "/admin/notifications" : role === "TEACHER" ? "/teacher/notifications" : "/student/notifications";

const TYPE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" | "purple" }> = {
  ATTENDANCE: { label: "Attendance", variant: "success" },
  SESSION: { label: "Session", variant: "info" },
  RISK_ALERT: { label: "Risk", variant: "danger" },
  RECOMMENDATION: { label: "Recommendation", variant: "purple" },
  REMINDER: { label: "Reminder", variant: "warning" },
  SYSTEM: { label: "Announcement", variant: "neutral" },
};

/** Full notification list with read/unread state, used on every role's notifications page. */
export function NotificationList({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    apiFetch<{ notifications: NotificationItem[]; unread: number }>(`/notifications?limit=100${onlyUnread ? "&unread=true" : ""}`).then((res) => {
      if (res.success && res.data) {
        setItems(res.data.notifications);
        setUnread(res.data.unread);
        setError(null);
      } else setError(res.error || "Could not load notifications.");
    });
  }, [onlyUnread, refresh, reloadKey]);

  const markRead = async (n: NotificationItem) => {
    if (n.isRead) return;
    const res = await apiFetch(`/notifications/${n.id}/read`, { method: "PATCH" });
    if (res.success) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
    }
  };

  const markAll = async () => {
    const res = await apiFetch("/notifications/read-all", { method: "POST" });
    if (res.success) setRefresh((r) => r + 1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" /> Notifications {unread > 0 && <Badge variant="purple" size="sm">{unread} unread</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 flex items-center gap-1.5">
              <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Unread only
            </label>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setRefresh((r) => r + 1)}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled={unread === 0} onClick={markAll}>
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        )}
        {!items && !error ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading…</p>
        ) : items && items.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">{onlyUnread ? "No unread notifications" : "No notifications yet"}</p>
            <p className="text-xs text-slate-500">Attendance updates, alerts and announcements will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items?.map((n) => {
              const t = TYPE[n.type] ?? TYPE.SYSTEM;
              return (
                <li key={n.id} className={`py-3 px-2 rounded-lg flex items-start gap-3 ${n.isRead ? "" : "bg-indigo-50/40"}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-transparent" : "bg-indigo-600"}`} aria-label={n.isRead ? "read" : "unread"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                      <Badge variant={t.variant} size="sm">{t.label}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatDate(n.createdAt)} {formatTime(n.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {n.link && (
                      <Link href={n.link} onClick={() => markRead(n)}>
                        <Button size="sm" variant="ghost" className="text-xs gap-1">
                          Open <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                    {!n.isRead && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => markRead(n)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
