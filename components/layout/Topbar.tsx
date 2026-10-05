"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BMUCrest } from "@/components/brand/BMUBrand";
import { findNavItem, PORTAL_NAME } from "./nav";

interface TopbarProps {
  onOpenMenu?: () => void;
}

/** Sticky portal bar: breadcrumb, notifications, account. The page title lives in PageHeader. */
export function Topbar({ onOpenMenu }: TopbarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const section = findNavItem(user?.role, pathname);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onOpenMenu && (
            <button
              onClick={onOpenMenu}
              className="lg:hidden p-2 -ml-2 rounded-md text-brand-800 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <BMUCrest height={26} className="lg:hidden" />
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-slate-500 min-w-0">
            <span className="hidden sm:inline font-semibold text-brand-800">AttendIQ</span>
            <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{user ? PORTAL_NAME[user.role] : "…"}</span>
            {section && (
              <>
                <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="font-medium text-slate-700 truncate">{section.name}</span>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user && <NotificationBell role={user.role} />}
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-700 text-white font-semibold text-xs flex items-center justify-center ring-2 ring-brand-100">
              {(user?.name || "?").charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-brand-950 leading-tight">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user?.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
