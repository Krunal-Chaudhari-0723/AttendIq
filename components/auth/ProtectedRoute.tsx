"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@/components/layout/Sidebar";
import { ShieldAlert, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BMU, BMUCrest } from "@/components/brand/BMUBrand";

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
      <div className="min-h-screen bg-[var(--surface-page)] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <BMUCrest height={64} priority />
          <p className="eyebrow text-brand-700">{BMU.name}</p>
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-brand-950">Verifying AttendIQ Credentials</h3>
            <p className="text-xs text-slate-500">Securing role authorization & RBAC permissions...</p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-brand-600" aria-hidden="true" />
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
      <div className="min-h-screen bg-[var(--surface-page)] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-xl border border-slate-200 border-t-[3px] border-t-accent-500 shadow-[var(--shadow-raised)] text-center space-y-5">
          <div className="flex flex-col items-center gap-2">
            <BMUCrest height={52} priority />
            <p className="eyebrow text-brand-700">{BMU.name}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-brand-950">403 Forbidden Access</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your account has the <span className="font-semibold text-brand-700">{user.role}</span> role. You do not have access permissions for this section.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => router.push(defaultDashboard)}
              className="w-full text-xs"
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
