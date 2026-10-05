"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  GraduationCap,
  Users,
  ShieldAlert,
  AlertCircle,
  KeyRound,
  ScanFace,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import { BMULogo } from "@/components/brand/BMUBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRole } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth/auth-context";

// Demo accounts are shown for hackathon demos; hide them in real deployments
// (NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false). Defaults to shown in development only.
const SHOW_DEMO_CREDENTIALS =
  process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== undefined
    ? process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true"
    : process.env.NODE_ENV !== "production";

const DEMO_ACCOUNTS = [
  ["ADMIN", "admin@attendiq.edu / Admin@123456"],
  ["TEACHER", "sharma@attendiq.edu / Teacher@123456"],
  ["STUDENT", "anand.student@attendiq.edu / Student@123456"],
];

function DemoAccounts({ tone, className }: { tone: "dark" | "light"; className?: string }) {
  const dark = tone === "dark";
  return (
    <div className={`p-4 rounded-lg border space-y-2 ${dark ? "bg-brand-950/50 border-white/10" : "bg-white border-slate-200"} ${className ?? ""}`}>
      <p className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? "text-accent-300" : "text-accent-700"}`}>
        <KeyRound className="w-4 h-4" /> Demo accounts
      </p>
      <div className={`text-[11px] space-y-1 font-mono [overflow-wrap:anywhere] ${dark ? "text-brand-100/80" : "text-slate-600"}`}>
        {DEMO_ACCOUNTS.map(([role, value]) => (
          <p key={role}>
            <span className={`font-semibold ${dark ? "text-white" : "text-brand-900"}`}>{role}:</span> {value}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();
  
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [email, setEmail] = useState("anand.student@attendiq.edu");
  const [password, setPassword] = useState("Student@123456");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto-fill role-specific default accounts for easy evaluation
  const handleRoleTabChange = (selectedRole: UserRole) => {
    setRole(selectedRole);
    clearError();
    setLocalError(null);
    if (selectedRole === "ADMIN") {
      setEmail("admin@attendiq.edu");
      setPassword("Admin@123456");
    } else if (selectedRole === "TEACHER") {
      setEmail("sharma@attendiq.edu");
      setPassword("Teacher@123456");
    } else {
      setEmail("anand.student@attendiq.edu");
      setPassword("Student@123456");
    }
  };

  // If already authenticated, redirect to role dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (user.role === "TEACHER") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setIsSubmitting(true);

    const result = await login(email, password, role);
    setIsSubmitting(false);

    if (result.success) {
      if (role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (role === "TEACHER") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--surface-page)]">
      {/* University identity panel */}
      <div className="lg:w-[46%] bg-brand-900 text-white px-6 py-6 sm:px-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Thin BMU orange rule along the edge */}
        <div className="absolute inset-x-0 top-0 h-1 bg-accent-500 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-1" aria-hidden="true" />

        <Link href="/" className="relative inline-flex" aria-label="Bhagwan Mahavir University — AttendIQ home">
          <BMULogo height={84} priority className="hidden sm:block" />
          <BMULogo height={60} priority className="sm:hidden" />
        </Link>

        <div className="relative mt-5 mb-1 lg:my-12 max-w-lg space-y-6">
          <div className="space-y-1.5 sm:space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">Smart Digital Campus</p>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight">
              Attend<span className="text-accent-500">IQ</span>
            </h1>
            <p className="text-xs sm:text-base text-brand-100/80 leading-relaxed">
              Smart Attendance &amp; Student Engagement System of Bhagwan Mahavir University.
            </p>
          </div>

          <ul className="hidden sm:grid gap-3 text-sm">
            {[
              { icon: ScanFace, title: "Verified attendance", text: "Face match, liveness check and campus location — decided on the server." },
              { icon: TrendingUp, title: "Engagement & academic standing", text: "Explainable scores built from attendance, quizzes, assignments and participation." },
              { icon: Lightbulb, title: "Academic insights", text: "Recommendations grounded in each student's recorded data." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-md bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent-400" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-xs text-brand-100/70 leading-relaxed">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          {SHOW_DEMO_CREDENTIALS && <DemoAccounts tone="dark" className="hidden lg:block" />}
        </div>

        <div className="relative hidden sm:flex text-[11px] text-brand-100/60 items-center justify-between gap-4 border-t border-white/10 pt-5">
          <p>
            <span className="text-white/90 font-medium">Bhagwan Mahavir University</span> · Vesu, Surat, Gujarat
          </p>
          <p>© 2026 AttendIQ</p>
        </div>
      </div>

      {/* Sign-in */}
      <div className="flex-1 px-4 py-6 sm:p-10 lg:p-12 flex flex-col items-center justify-center gap-4">
        <div className="w-full max-w-md space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 border-t-[3px] border-t-accent-500 shadow-[var(--shadow-raised)]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-brand-700">
              <ShieldCheck className="w-4 h-4" />
              <p className="eyebrow text-brand-700">Secure sign-in</p>
            </div>
            <h2 className="text-2xl font-semibold text-brand-950 tracking-tight">
              Sign In to Portal
            </h2>
            <p className="text-xs text-slate-500">
              Select your role and sign in with the account issued by the university.
            </p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" role="tablist" aria-label="Sign in as">
            {[
              { id: "STUDENT", label: "Student", icon: Users },
              { id: "TEACHER", label: "Teacher", icon: GraduationCap },
              { id: "ADMIN", label: "Admin", icon: ShieldAlert },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={role === tab.id}
                  onClick={() => handleRoleTabChange(tab.id as UserRole)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-colors ${
                    role === tab.id
                      ? "bg-brand-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-brand-800 hover:bg-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Display Auth Errors */}
          {(authError || localError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn" role="alert">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError || localError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                icon={<Mail className="w-4 h-4 text-slate-400" />}
                placeholder="email@attendiq.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-brand-700 hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                icon={<Lock className="w-4 h-4 text-slate-400" />}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 accent-brand-700 w-4 h-4"
                />
                <span className="text-xs text-slate-600">Remember session</span>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || authLoading}
              className="w-full mt-2"
            >
              {isSubmitting || authLoading ? (
                "Authenticating..."
              ) : (
                <span className="flex items-center gap-2">
                  Sign In as {role} <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
            Don&apos;t have an account?{" "}
            <a href="#" className="text-brand-700 font-medium hover:underline">
              Contact your administrator
            </a>
          </div>
        </div>
        {SHOW_DEMO_CREDENTIALS && <DemoAccounts tone="light" className="w-full max-w-md lg:hidden" />}
        <p className="sm:hidden text-[11px] text-slate-500 text-center">
          <span className="font-medium text-brand-800">Bhagwan Mahavir University</span> · Vesu, Surat, Gujarat
        </p>
      </div>
    </div>
  );
}
