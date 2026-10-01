"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileView } from "@/components/profile/ProfileView";

export default function TeacherProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell title="My Profile" subtitle="Your account, classes and security" defaultRole="TEACHER">
        <ProfileView />
      </AppShell>
    </ProtectedRoute>
  );
}
