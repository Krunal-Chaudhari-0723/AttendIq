"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function StudentNotificationsPage() {
  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title="Notifications" subtitle="Attendance updates, reminders, alerts and announcements" defaultRole="STUDENT">
        <div className="max-w-4xl">
          <NotificationList />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
