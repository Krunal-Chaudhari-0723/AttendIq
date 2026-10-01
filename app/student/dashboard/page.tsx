"use client";

import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Activity, AlertTriangle, Lightbulb, Camera, ArrowRight } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function StudentDashboardPage() {
  const subjectAttendance = [
    { subject: "Advanced Javascript", percentage: 88, status: "Good" },
    { subject: "Database Systems", percentage: 82, status: "Good" },
    { subject: "Web Technologies", percentage: 76, status: "Average" },
    { subject: "Software Engineering", percentage: 65, status: "Needs Attention" },
  ];

  return (
    <ProtectedRoute allowedRoles={["STUDENT", "ADMIN"]}>
      <AppShell
        title="Welcome, Anand Chaudhari"
        subtitle="Overview of your physical attendance, engagement metrics, and AI recommendations"
        defaultRole="STUDENT"
      >
        <div className="space-y-6">
          {/* Quick Attendance Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Class Attendance Window Open</h3>
                <p className="text-xs text-indigo-100">
                  Advanced Javascript • Location & Face Verification Required
                </p>
              </div>
            </div>
            <Link href="/student/live-attendance">
              <Button variant="outline" className="bg-white text-indigo-700 hover:bg-indigo-50 border-none font-bold text-xs shadow-md">
                Mark Physical Attendance <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="My Attendance"
              value="82%"
              change="Target: 75%"
              changeType="positive"
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <StatsCard
              title="Overall Score"
              value="76 / 100"
              change="Transparent AI"
              changeType="positive"
              icon={<Activity className="w-5 h-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Academic Risk"
              value="MEDIUM"
              change="Rule-based"
              changeType="negative"
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
            <StatsCard
              title="Assignments Completed"
              value="8 / 10"
              change="80% Done"
              changeType="neutral"
              icon={<Lightbulb className="w-5 h-5" />}
              iconBg="bg-purple-50 text-purple-600"
            />
          </div>

          {/* Breakdown Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Subject-wise Attendance Rate</CardTitle>
                <p className="text-xs text-slate-500">Verified attendance percentage by subject</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjectAttendance.map((item, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{item.subject}</span>
                      <span className={item.percentage < 75 ? "text-rose-600" : "text-slate-700"}>
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.percentage >= 80
                            ? "bg-emerald-500"
                            : item.percentage >= 75
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 text-slate-100 border-slate-800">
              <CardHeader className="border-slate-800">
                <CardTitle className="text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>AI Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="warning" size="sm">High Priority</Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    Focus on Software Engineering
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Attendance is 65%. Attending the next 3 sessions brings your percentage to 75% threshold.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="purple" size="sm">Medium Priority</Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    Complete SQL Join Practice Quiz
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Quiz weight is 25% of your engagement score. Completing it will raise your score from 76 to 82.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
