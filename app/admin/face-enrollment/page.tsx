"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/api";
import { ScanFace, Search, CheckCircle2, AlertCircle, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";

interface StudentFaceItem {
  _id: string;
  studentId: string;
  name: string;
  email: string;
  rollNumber: string;
  className: string;
  isFaceEnrolled: boolean;
  status: string;
}

export default function AdminFaceEnrollmentPage() {
  const [students, setStudents] = useState<StudentFaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [purging, setPurging] = useState(false);

  const fetchStudents = async () => {
    try {
      let query = "/admin/students?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (filter) query += `isFaceEnrolled=${encodeURIComponent(filter)}&`;

      const res = await apiFetch<{ students: StudentFaceItem[] }>(query);
      if (res.success && res.data) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error("Failed to load students for face admin:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, filter]);

  const handleAuthorizeReEnrollment = async () => {
    if (!confirmTarget || purging) return;
    const { id, name } = confirmTarget;
    setPurging(true);
    setActionError(null);
    const res = await apiFetch(`/admin/students/${id}/face-status`, {
      method: "PATCH",
      body: JSON.stringify({ reAuthorize: true }),
    });
    setPurging(false);
    setConfirmTarget(null);

    if (res.success) {
      setActionSuccess(`Face profile deleted. ${name} can now enroll again.`);
      setTimeout(() => setActionSuccess(null), 3500);
      fetchStudents();
    } else {
      setActionError(res.error || "Could not authorize re-enrollment.");
    }
  };

  const enrolledCount = students.filter((s) => s.isFaceEnrolled).length;
  const pendingCount = students.length - enrolledCount;

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Face Enrollment Administration"
        subtitle="Manage student biometric registration status, audit compliance, and authorize re-enrollment"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-fadeIn">
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">{actionError}</div>
          )}

          {/* Privacy & Security Notice Banner */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-start gap-3 shadow-md">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                How face data is protected
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Camera images are processed on the student&apos;s device and never uploaded. Only a 128-number face signature is stored, encrypted with AES-256-GCM, and it is never returned by any API. Admins can see enrollment status and authorize re-enrollment, but cannot view biometric data.
              </p>
            </div>
          </div>

          {/* Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-indigo-600">
              <CardContent className="pt-4 pb-4">
                <span className="text-xs text-slate-500 font-semibold uppercase">Total Students</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{students.length}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600">
              <CardContent className="pt-4 pb-4">
                <span className="text-xs text-slate-500 font-semibold uppercase">Face Enrolled</span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{enrolledCount}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-600">
              <CardContent className="pt-4 pb-4">
                <span className="text-xs text-slate-500 font-semibold uppercase">Pending Enrollment</span>
                <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white text-xs h-9"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Enrollment Statuses</option>
                <option value="true">Enrolled Only</option>
                <option value="false">Pending Only</option>
              </select>
            </div>

            <Button variant="outline" size="sm" onClick={() => {
                  setIsLoading(true);
                  fetchStudents();
                }} className="text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {/* Face Directory Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-indigo-600" />
                <span>Student Biometric Status Directory</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Enrollment State</TableHead>
                    <TableHead>Biometric Embedding</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Auditing face enrollment states...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell className="font-mono text-xs font-bold text-slate-700">
                          {student.studentId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{student.name}</p>
                            <p className="text-[11px] text-slate-400">{student.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{student.rollNumber}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">{student.className}</TableCell>
                        <TableCell>
                          {student.isFaceEnrolled ? (
                            <Badge variant="success" size="sm" className="gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Enrolled (128-d)
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" className="gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Not Enrolled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-slate-500">
                            {student.isFaceEnrolled ? "Encrypted (AES-256-GCM)" : "None"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {student.isFaceEnrolled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmTarget({ id: student._id, name: student.name })}
                              className="text-xs gap-1 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Re-Authorize
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Awaiting Student</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <Modal
          isOpen={Boolean(confirmTarget)}
          onClose={() => !purging && setConfirmTarget(null)}
          title="Authorize face re-enrollment?"
          subtitle={confirmTarget ? `This permanently deletes ${confirmTarget.name}'s enrolled face profile. They will not be able to mark attendance until they enroll again.` : undefined}
          maxWidth="sm"
        >
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={purging} onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled={purging} onClick={handleAuthorizeReEnrollment}>
              {purging ? "Deleting…" : "Delete face profile"}
            </Button>
          </div>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
