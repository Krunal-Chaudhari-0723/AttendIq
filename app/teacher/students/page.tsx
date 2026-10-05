"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { StudentInsightsModal } from "@/components/risk/StudentInsightsModal";
import { Users, Search, RefreshCw } from "lucide-react";

interface TeacherStudent {
  _id: string;
  studentId: string;
  name: string;
  email: string;
  rollNumber: string;
  className: string;
  isFaceEnrolled: boolean;
  riskLevel: string;
  riskReason: string;
  attendanceRate: number | null;
  engagementScore: number | null;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/teacher/students");
      if (res.success && res.data) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell
        title="Student Roster"
        subtitle="Monitor students enrolled in your assigned courses, attendance performance, and engagement standing"
        defaultRole="TEACHER"
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 flex-wrap">
            <div className="relative w-full sm:max-w-sm">
              <Input
                icon={<Search className="w-4 h-4 text-slate-400" />}
                placeholder="Search enrolled students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => {
                  setIsLoading(true);
                  fetchStudents();
                }} className="self-start sm:self-auto">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <span>Enrolled Class Students</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Attendance Rate</TableHead>
                    <TableHead>Engagement Score</TableHead>
                    <TableHead>Risk Classification</TableHead>
                    <TableHead>Causal Factor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-left sm:text-center py-10 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading student rosters...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-left sm:text-center py-10 text-xs text-slate-500">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => (
                      <TableRow key={s._id} className="cursor-pointer" onClick={() => setSelected(s.studentId)}>
                        <TableCell className="text-xs font-semibold text-brand-700 tabular-nums">{s.studentId}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold text-brand-950 text-sm whitespace-nowrap">{s.name}</p>
                            <p className="text-[11px] text-slate-500">{s.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">{s.className}</TableCell>
                        <TableCell className="text-sm tabular-nums font-semibold text-brand-950">{s.attendanceRate === null ? "—" : `${s.attendanceRate}%`}</TableCell>
                        <TableCell className="text-sm tabular-nums font-semibold text-brand-700 whitespace-nowrap">{s.engagementScore === null ? "—" : `${s.engagementScore} / 100`}</TableCell>
                        <TableCell>
                          <RiskBadge level={s.riskLevel} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 min-w-56 leading-snug">{s.riskReason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <StudentInsightsModal studentId={selected} onClose={() => setSelected(null)} />
      </AppShell>
    </ProtectedRoute>
  );
}
