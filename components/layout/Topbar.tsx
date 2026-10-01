"use client";

import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export function Topbar({ title = "Dashboard", subtitle = "Welcome to AttendIQ" }: TopbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs gap-4">
      <div className="min-w-0 pl-10 lg:pl-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none truncate">{title}</h1>
        <p className="text-xs text-slate-500 mt-1 font-normal truncate hidden sm:block">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {user && <NotificationBell role={user.role} />}
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-3 pl-1">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs ring-2 ring-indigo-100">
            {(user?.name || "?").charAt(0)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user?.role}</p>
          </div>
          <button onClick={() => logout()} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors" title="Sign Out" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
