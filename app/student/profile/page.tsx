"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileView } from "@/components/profile/ProfileView";

export default function StudentProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title="My Profile" subtitle="Your account, academic details and security" defaultRole="STUDENT">
        <ProfileView />
      </AppShell>
    </ProtectedRoute>
  );
}
