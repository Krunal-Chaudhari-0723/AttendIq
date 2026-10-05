"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AttendanceReport } from "@/components/reports/AttendanceReport";
import { PerformanceReport } from "@/components/reports/PerformanceReport";
import { CalendarCheck, Award, Activity, AlertTriangle, ArrowRight, Info } from "lucide-react";

type Tab = "attendance" | "performance";

export default function TeacherReportsPage() {
  const [tab, setTab] = useState<Tab>("attendance");
  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Reports" subtitle="Attendance and performance for the sessions and subjects you teach" defaultRole="TEACHER">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "attendance", label: "Attendance", icon: CalendarCheck },
                { value: "performance", label: "Performance", icon: Award },
              ]}
            />
            <div className="flex gap-2">
              <Link href="/teacher/engagement">
                <Button variant="outline" size="sm">
                  <Activity className="w-3.5 h-3.5 text-brand-600" /> Engagement <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
              <Link href="/teacher/risk-analysis">
                <Button variant="outline" size="sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-brand-600" /> Risk <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
          {tab === "attendance" ? (
            <AttendanceReport endpoint="/teacher/reports/attendance" />
          ) : (
            <PerformanceReport endpoint="/teacher/reports/performance" />
          )}
          <div className="flex gap-3 p-4 rounded-lg bg-brand-50/60 border border-brand-100 text-xs text-brand-900">
            <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Attendance covers sessions you ran. Performance covers quizzes and assignments in subjects you teach, for students in your classes.
            </span>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
