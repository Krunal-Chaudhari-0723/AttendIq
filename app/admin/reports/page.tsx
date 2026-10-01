"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Tabs } from "@/components/ui/tabs";
import { AttendanceReport } from "@/components/reports/AttendanceReport";
import { PerformanceReport } from "@/components/reports/PerformanceReport";
import { EngagementAnalytics } from "@/components/analytics/EngagementAnalytics";
import { RiskAnalytics } from "@/components/analytics/RiskAnalytics";
import { CalendarCheck, Award, Activity, AlertTriangle } from "lucide-react";

type Tab = "attendance" | "performance" | "engagement" | "risk";

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>("attendance");
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell title="Reports & Analytics" subtitle="Institution-wide attendance, performance, engagement and risk — computed from recorded data" defaultRole="ADMIN">
        <div className="space-y-6">
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
          {tab === "attendance" && <AttendanceReport endpoint="/admin/reports/attendance" showTeachers />}
          {tab === "performance" && <PerformanceReport endpoint="/admin/reports/performance" />}
          {tab === "engagement" && <EngagementAnalytics />}
          {tab === "risk" && <RiskAnalytics />}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
