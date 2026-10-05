"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { BMUSidebarBrand } from "@/components/brand/BMUBrand";
import { NAV, PORTAL_NAME, isActivePath, UserRole } from "./nav";

export type { UserRole } from "./nav";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Navigation always follows the authenticated role; the server enforces access regardless
  const activeRole: UserRole | null = user ? user.role : null;
  const groups = activeRole ? NAV[activeRole] : [];

  return (
    <aside className="w-64 bg-brand-900 text-brand-100 flex flex-col h-screen sticky top-0 shrink-0 select-none z-30">
      {/* University identity */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <Link href="/" onClick={onNavigate} className="block rounded-lg focus-visible:outline-accent-500">
          <BMUSidebarBrand />
        </Link>
      </div>

      {/* Portal the signed-in user is in (from the verified session) */}
      <div className="px-5 py-2.5 border-b border-white/10 bg-brand-950/40 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
        <p className="text-[11px] font-semibold tracking-wide text-brand-100/90">{activeRole ? PORTAL_NAME[activeRole] : "…"}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-200/50">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 pl-3 pr-2 py-2 rounded-md text-[13px] transition-colors",
                      isActive
                        ? "bg-white/10 text-white font-semibold"
                        : "text-brand-100/75 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent-500" aria-hidden="true" />}
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-accent-400" : "text-brand-200/70")} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="p-3 border-t border-white/10 bg-brand-950/40">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white font-semibold text-xs flex items-center justify-center shrink-0">
            {(user?.name || "?").charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10.5px] text-brand-100/60 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-brand-100/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
