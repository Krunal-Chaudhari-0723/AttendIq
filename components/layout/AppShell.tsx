"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { Sidebar, UserRole } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PageHeader } from "./PageHeader";
import { BMU } from "@/components/brand/BMUBrand";
import { DeveloperCredit } from "@/components/brand/DeveloperCredit";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Kept for compatibility; navigation always follows the signed-in user's role. */
  defaultRole?: UserRole;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--surface-page)] antialiased text-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:block bg-brand-900">
        <Sidebar />
      </div>

      {/* Tablet / mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-brand-950/60 animate-fadeIn" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative z-10 shadow-2xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute z-40 top-3 right-3 p-1.5 rounded-md text-brand-100/80 hover:text-white hover:bg-white/10"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto">
          {title && <PageHeader title={title} subtitle={subtitle} />}
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <p>
              <span className="font-semibold text-brand-800">{BMU.name}</span> · {BMU.location}
            </p>
            <p>
              {BMU.product} — {BMU.tagline}
            </p>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <DeveloperCredit className="sm:text-center" />
          </div>
        </footer>
      </div>
    </div>
  );
}
