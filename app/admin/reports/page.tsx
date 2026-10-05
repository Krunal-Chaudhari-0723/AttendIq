"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Tabs } from "@/components/ui/tabs";
import { AttendanceReport } from "@/components/reports/AttendanceReport";
import { PerformanceReport } from "@/components/reports/PerformanceReport";
import { EngagementAnalytics } from "@/components/analytics/EngagementAnalytics";
import { RiskAnalytics } from "@/components/analytics/RiskAnalytics";
import { BMU } from "@/components/brand/BMUBrand";
import { CalendarCheck, Award, Activity, AlertTriangle, BarChart3 } from "lucide-react";

type Tab = "attendance" | "performance" | "engagement" | "risk";

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>("attendance");
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell title="Reports & Analytics" subtitle="Institution-wide attendance, performance, engagement and risk — computed from recorded data" defaultRole="ADMIN">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 sm:px-5 py-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="eyebrow text-brand-600">Institutional analytics</p>
                <p className="text-sm font-semibold text-brand-950">{BMU.name}</p>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "attendance", label: "Attendance", icon: CalendarCheck },
                  { value: "performance", label: "Performance", icon: Award },
                  { value: "engagement", label: "Engagement", icon: Activity },
                  { value: "risk", label: "Academic Risk", icon: AlertTriangle },
                ]}
              />
            </div>
          </div>
          {tab === "attendance" && <AttendanceReport endpoint="/admin/reports/attendance" showTeachers />}
          {tab === "performance" && <PerformanceReport endpoint="/admin/reports/performance" />}
          {tab === "engagement" && <EngagementAnalytics />}
          {tab === "risk" && <RiskAnalytics />}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
