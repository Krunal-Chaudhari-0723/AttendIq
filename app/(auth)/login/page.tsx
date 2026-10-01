"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  GraduationCap,
  Users,
  ShieldAlert,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRole } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth/auth-context";

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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 text-slate-100">
      {/* Left Branding Panel */}
      <div className="md:w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-12 flex flex-col justify-between border-r border-slate-800/80 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-2xl text-white tracking-tight">
                Attend<span className="text-indigo-400">IQ</span>
              </span>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Smart Attendance & Student Engagement System
              </p>
            </div>
          </Link>
        </div>

        <div className="my-12 relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Face • Campus location • Liveness • Explainable analytics</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            More than Attendance — <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
              Smarter Learning for a Brighter Future
            </span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Secure multi-role authentication backed by Express, Mongoose, bcrypt password hashing, HTTP-Only cookies, and strict Role-Based Access Control.
          </p>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-400" /> Demo Credentials Ready
            </p>
            <div className="text-[11px] text-slate-400 space-y-1 font-mono">
              <p><span className="text-slate-300 font-bold">ADMIN:</span> admin@attendiq.edu / Admin@123456</p>
              <p><span className="text-slate-300 font-bold">TEACHER:</span> sharma@attendiq.edu / Teacher@123456</p>
              <p><span className="text-slate-300 font-bold">STUDENT:</span> anand.student@attendiq.edu / Student@123456</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-6">
          <p>© 2026 AttendIQ. All rights reserved.</p>
          <p className="text-indigo-400 font-mono text-[11px]">Secure role-based access</p>
        </div>
      </div>

      {/* Right Login Card Panel */}
      <div className="md:w-1/2 bg-slate-950 p-8 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-md space-y-7 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Sign In to Portal
            </h2>
            <p className="text-xs text-slate-400">
              Select your role and authenticate with your credentials
            </p>
          </div>

          {/* Role Tab Selector (Screen 1 UI Reference) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
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
                  onClick={() => handleRoleTabChange(tab.id as UserRole)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    role === tab.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
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
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError || localError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Email Address
              </label>
              <Input
                type="email"
                required
                icon={<Mail className="w-4 h-4 text-slate-400" />}
                placeholder="email@attendiq.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-indigo-400 hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                type="password"
                required
                icon={<Lock className="w-4 h-4 text-slate-400" />}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs text-slate-400">Remember session</span>
              </label>
              <span className="text-[11px] text-indigo-400 font-mono">
                Tab: {role}
              </span>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 mt-2"
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

          <div className="text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
            Don&apos;t have an account?{" "}
            <a href="#" className="text-indigo-400 font-medium hover:underline">
              Contact your administrator
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
