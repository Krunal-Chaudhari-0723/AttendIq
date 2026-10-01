"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function TeacherNotificationsPage() {
  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="Notifications" subtitle="Risk alerts for your students and institution announcements" defaultRole="TEACHER">
        <div className="max-w-4xl">
          <NotificationList />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
