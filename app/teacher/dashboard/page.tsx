"use client";

import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { BookOpen, CheckCircle2, Activity, AlertTriangle, Radio, Play } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function TeacherDashboardPage() {
  const teacherClasses = [
    { name: "Advanced Javascript", code: "MCA Sem 2", time: "09:30 AM - 10:30 AM", status: "Active Session", count: "28 Students" },
    { name: "Database Systems", code: "BCA Sem 4", time: "11:30 AM - 12:30 PM", status: "Scheduled", count: "32 Students" },
    { name: "Web Technologies", code: "BCA Sem 2", time: "02:00 PM - 03:00 PM", status: "Completed", count: "30 Students" },
  ];

  return (
    <ProtectedRoute allowedRoles={["TEACHER", "ADMIN"]}>
      <AppShell
        title="Welcome Prof. Sharma"
        subtitle="Here's what's happening with your class attendance and student engagement today"
        defaultRole="TEACHER"
      >
        <div className="space-y-6">
          {/* Quick Action Bar to Start Attendance Session */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span>Ready to start today's attendance session?</span>
              </h3>
              <p className="text-xs text-indigo-200">
                Enable Physical Campus Verification or Remote Mode for your active class window.
              </p>
            </div>
            <Link href="/teacher/live-attendance">
              <Button variant="success" size="md" className="font-semibold shadow-md gap-2">
                <Play className="w-4 h-4" /> Start Attendance Session
              </Button>
            </Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Classes"
              value="3"
              change="Sem 2 & Sem 4"
              changeType="neutral"
              icon={<BookOpen className="w-5 h-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Today's Attendance"
              value="84%"
              change="+2% vs yesterday"
              changeType="positive"
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <StatsCard
              title="Average Engagement"
              value="72 / 100"
              change="GOOD"
              changeType="positive"
              icon={<Activity className="w-5 h-5" />}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatsCard
              title="At-Risk Students"
              value="5"
              change="Action needed"
              changeType="negative"
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Classes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Teaching Schedule</CardTitle>
              <p className="text-xs text-slate-500">Scheduled sessions and live attendance tracking</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class / Division</TableHead>
                    <TableHead>Time Window</TableHead>
                    <TableHead>Total Enrolled</TableHead>
                    <TableHead>Session Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherClasses.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-slate-900">{c.name}</TableCell>
                      <TableCell>{c.code}</TableCell>
                      <TableCell className="font-mono text-xs">{c.time}</TableCell>
                      <TableCell>{c.count}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            c.status === "Active Session"
                              ? "success"
                              : c.status === "Scheduled"
                              ? "purple"
                              : "neutral"
                          }
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href="/teacher/live-attendance">
                          <Button size="sm" variant={c.status === "Active Session" ? "primary" : "outline"}>
                            {c.status === "Active Session" ? "Monitor Live" : "View Session"}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
