"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { BookOpen, Users, RefreshCw } from "lucide-react";
import Link from "next/link";

interface TeacherClass {
  _id: string;
  name: string;
  code: string;
  division?: string;
  semester?: number;
  department?: string;
  academicYear?: string;
  studentCount?: number;
  classTeacher?: { name?: string; teacherId?: string } | null;
  subjects?: { id: string; name: string; code: string; teacher: string | null; isMine: boolean }[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClasses = async () => {
    try {
      const res = await apiFetch("/teacher/classes");
      if (res.success && res.data) {
        setClasses(res.data.classes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell
        title="Assigned Classes"
        subtitle="View and manage the classes and student cohorts assigned to your teaching workload"
        defaultRole="TEACHER"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">My Teaching Cohorts</h3>
            <Button variant="outline" size="sm" onClick={() => {
                  setIsLoading(true);
                  fetchClasses();
                }} className="text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Class Roster</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Code</TableHead>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Enrolled Students</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading assigned classes...
                      </TableCell>
                    </TableRow>
                  ) : classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        No classes assigned yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((cls) => (
                      <TableRow key={cls._id}>
                        <TableCell className="font-mono text-xs font-bold text-slate-700">{cls.code}</TableCell>
                        <TableCell className="font-semibold text-xs text-slate-900">{cls.name}</TableCell>
                        <TableCell>
                          <Badge variant="purple" size="sm">Div {cls.division}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">Semester {cls.semester}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">{cls.academicYear}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cls.studentCount ?? 0} Students</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href="/teacher/students">
                            <Button size="sm" variant="outline" className="text-xs">
                              View Roster
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
