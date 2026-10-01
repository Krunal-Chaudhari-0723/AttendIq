"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { NotificationItem, notificationsPath } from "./NotificationList";

/** Top-bar bell: unread count (refreshed every minute) and the latest notifications. */
export function NotificationBell({ role }: { role: "ADMIN" | "TEACHER" | "STUDENT" }) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      apiFetch<{ unread: number }>("/notifications/unread-count").then((res) => {
        if (alive && res.success && res.data) setUnread(res.data.unread);
      });
    tick();
    const id = setInterval(() => !document.hidden && tick(), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ notifications: NotificationItem[]; unread: number }>("/notifications?limit=8").then((res) => {
      if (res.success && res.data) {
        setItems(res.data.notifications);
        setUnread(res.data.unread);
      }
    });
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAll = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, isRead: true })) ?? null);
  };

  const markOne = (n: NotificationItem) => {
    if (n.isRead) return;
    apiFetch(`/notifications/${n.id}/read`, { method: "PATCH" });
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!items ? (
              <p className="text-xs text-slate-400 p-4">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const body = (
                  <div className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${n.isRead ? "" : "bg-indigo-50/40"}`}>
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(n.createdAt)} {formatTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markOne(n); setOpen(false); }}>
                    {body}
                  </Link>
                ) : (
                  <button key={n.id} className="w-full text-left" onClick={() => markOne(n)}>
                    {body}
                  </button>
                );
              })
            )}
          </div>
          <Link href={notificationsPath(role)} onClick={() => setOpen(false)} className="block text-center text-xs font-semibold text-indigo-700 py-2.5 border-t border-slate-100 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
