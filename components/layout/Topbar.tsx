"use client";

import React from "react";
import { Search, Bell, MapPin, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserRole } from "./Sidebar";
import { useAuth } from "@/lib/auth/auth-context";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  role?: UserRole;
}

export function Topbar({
  title = "Dashboard",
  subtitle = "Welcome to AttendIQ Platform",
  role: overrideRole,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const activeRole = overrideRole || (user ? user.role : "ADMIN");

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Page Title & Context */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
          {title}
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-normal">
          {subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:block w-64">
          <Input
            icon={<Search className="w-4 h-4" />}
            placeholder="Search students, classes..."
            className="h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        {/* Campus Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          <span>Main Campus Verified</span>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-1">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs ring-2 ring-indigo-100">
            {(user?.name || activeRole).charAt(0)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {user?.name || (activeRole === "ADMIN" ? "Admin User" : activeRole === "TEACHER" ? "Prof. Sharma" : "Krunal Chaudhari")}
            </p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              {activeRole}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
