"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ScanFace,
  MapPin,
  FileBarChart,
  Settings,
  Activity,
  AlertTriangle,
  Lightbulb,
  Bell,
  User,
  Radio,
  CheckCircle,
  Sparkles,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

interface SidebarProps {
  role?: UserRole;
  onRoleChange?: (role: UserRole) => void;
}

export function Sidebar({ role: overrideRole, onRoleChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const activeRole: UserRole = overrideRole || (user ? user.role : "ADMIN");

  const navItems = {
    ADMIN: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Students", href: "/admin/students", icon: Users },
      { name: "Teachers", href: "/admin/teachers", icon: GraduationCap },
      { name: "Classes / Divisions", href: "/admin/classes", icon: BookOpen },
      { name: "Subjects", href: "/admin/subjects", icon: BookOpen },
      { name: "Academic Years", href: "/admin/academic-years", icon: Calendar },
      { name: "Face Enrollment", href: "/admin/face-enrollment", icon: ScanFace },
      { name: "Campus Settings", href: "/admin/campus-settings", icon: MapPin },
      { name: "Reports & Analytics", href: "/admin/reports", icon: FileBarChart },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
    TEACHER: [
      { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
      { name: "Classes", href: "/teacher/classes", icon: BookOpen },
      { name: "Attendance", href: "/teacher/attendance", icon: CheckCircle },
      { name: "Live Attendance", href: "/teacher/live-attendance", icon: Radio },
      { name: "Students", href: "/teacher/students", icon: Users },
      { name: "Engagement", href: "/teacher/engagement", icon: Activity },
      { name: "Risk Analysis", href: "/teacher/risk-analysis", icon: AlertTriangle },
      { name: "AI Recommendations", href: "/teacher/recommendations", icon: Lightbulb },
      { name: "Reports", href: "/teacher/reports", icon: FileBarChart },
    ],
    STUDENT: [
      { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
      { name: "My Attendance", href: "/student/attendance", icon: CheckCircle },
      { name: "Live Attendance", href: "/student/live-attendance", icon: Radio },
      { name: "Engagement", href: "/student/engagement", icon: Activity },
      { name: "Performance", href: "/student/performance", icon: FileBarChart },
      { name: "AI Recommendations", href: "/student/recommendations", icon: Lightbulb },
      { name: "Notifications", href: "/student/notifications", icon: Bell },
      { name: "Profile", href: "/student/profile", icon: User },
    ],
  };

  const currentNav = navItems[activeRole] || navItems.ADMIN;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-800 shadow-xl select-none z-30">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1">
              Attend<span className="text-indigo-400">IQ</span>
            </span>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              Smart System
            </p>
          </div>
        </Link>
      </div>

      {/* Role Selector Badge (Phase 2 Auth Info) */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/40">
        <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1.5 px-2">
          Active Role Session
        </p>
        <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(["ADMIN", "TEACHER", "STUDENT"] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => onRoleChange && onRoleChange(r)}
              className={cn(
                "py-1 px-1.5 text-[10px] font-semibold rounded text-center transition-all",
                activeRole === r
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Navigation Menu
          </p>
        </div>
        {currentNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 font-semibold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span>{item.name}</span>
              </div>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Account Overview & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs flex items-center justify-center shrink-0">
              {(user?.name || activeRole).charAt(0)}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.name || (activeRole === "ADMIN" ? "System Admin" : activeRole === "TEACHER" ? "Prof. Sharma" : "Anand Chaudhari")}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                {user?.email ? user.email.split("@")[0] : activeRole}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
