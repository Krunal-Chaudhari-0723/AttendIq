"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@/components/layout/Sidebar";
import { ShieldAlert, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1 text-center">
            <h3 className="text-base font-bold tracking-tight">Verifying AttendIQ Credentials</h3>
            <p className="text-xs text-slate-400">Securing role authorization & RBAC permissions...</p>
          </div>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-indeterminate" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect via useEffect
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const defaultDashboard =
      user.role === "ADMIN"
        ? "/admin/dashboard"
        : user.role === "TEACHER"
        ? "/teacher/dashboard"
        : "/student/dashboard";

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">403 Forbidden Access</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account has the <span className="font-semibold text-indigo-400">{user.role}</span> role. You do not have access permissions for this section.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => router.push(defaultDashboard)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs py-2.5 shadow-md shadow-indigo-600/30"
            >
              Return to My {user.role} Dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
