"use client";

import React, { useState } from "react";
import { Sidebar, UserRole } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  defaultRole?: UserRole;
}

export function AppShell({
  children,
  title,
  subtitle,
  defaultRole = "ADMIN",
}: AppShellProps) {
  const [role, setRole] = useState<UserRole>(defaultRole);

  return (
    <div className="flex min-h-screen bg-slate-50 antialiased text-slate-900">
      {/* Dark Navy Sidebar */}
      <Sidebar role={role} onRoleChange={(r) => setRole(r)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} role={role} />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
