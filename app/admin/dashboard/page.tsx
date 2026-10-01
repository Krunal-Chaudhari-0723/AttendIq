"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Users, GraduationCap, BookOpen, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function AdminDashboardPage() {
  const atRiskStudents = [
    { id: "S101", name: "Rahul Verma", class: "MCA Sem 2", attendance: "62%", risk: "HIGH", reason: "3 consecutive absences & low quiz score" },
    { id: "S102", name: "Ananya Sharma", class: "BCA Sem 4", attendance: "68%", risk: "MEDIUM", reason: "Attendance drop in Web Tech" },
    { id: "S103", name: "Karan Singh", class: "BCA Sem 2", attendance: "71%", risk: "MEDIUM", reason: "Low assignment submission rate" },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Welcome Admin"
        subtitle="Manage your institution, configure campus bounds, and monitor attendance progress"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Students"
              value="124"
              change="+12 this month"
              changeType="positive"
              icon={<Users className="w-5 h-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Total Teachers"
              value="12"
              change="Active faculty"
              changeType="neutral"
              icon={<GraduationCap className="w-5 h-5" />}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatsCard
              title="Total Classes"
              value="8"
              change="Active divisions"
              changeType="neutral"
              icon={<BookOpen className="w-5 h-5" />}
              iconBg="bg-purple-50 text-purple-600"
            />
            <StatsCard
              title="Today's Attendance"
              value="86%"
              change="+4% vs last week"
              changeType="positive"
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
          </div>

          {/* Analytics & Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Attendance Trend</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">Weekly attendance performance across all departments</p>
                </div>
                <Badge variant="purple" size="sm">Live Feed</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex flex-col justify-between pt-4">
                  <div className="flex-1 flex items-end gap-3 px-2">
                    {[
                      { day: "Mon", rate: 88, count: "109/124" },
                      { day: "Tue", rate: 92, count: "114/124" },
                      { day: "Wed", rate: 84, count: "104/124" },
                      { day: "Thu", rate: 89, count: "110/124" },
                      { day: "Fri", rate: 86, count: "107/124" },
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {bar.count}
                        </span>
                        <div className="w-full bg-slate-100 rounded-t-lg h-44 flex items-end overflow-hidden p-1">
                          <div
                            className="w-full bg-indigo-600 rounded-t-md transition-all duration-500 group-hover:bg-indigo-500"
                            style={{ height: `${bar.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600">{bar.day} ({bar.rate}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <p className="text-xs text-slate-500">Student academic risk classification</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-emerald-700">Low Risk (84%)</span>
                      <span className="text-slate-600">104 Students</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: "84%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-amber-700">Medium Risk (12%)</span>
                      <span className="text-slate-600">15 Students</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: "12%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-rose-700">High Risk (4%)</span>
                      <span className="text-slate-600">5 Students</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: "4%" }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                    <p className="text-[11px] text-slate-600 leading-tight">
                      Risk indicators combine attendance trends, quiz performance, and assignment completion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top At-Risk Students Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Top At-Risk Students</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Students requiring immediate academic attention or outreach</p>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class / Division</TableHead>
                    <TableHead>Attendance Rate</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Contributing Factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRiskStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-600">{student.id}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{student.name}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell className="font-semibold">{student.attendance}</TableCell>
                      <TableCell>
                        <Badge variant={student.risk === "HIGH" ? "danger" : "warning"}>
                          {student.risk} RISK
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{student.reason}</TableCell>
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
