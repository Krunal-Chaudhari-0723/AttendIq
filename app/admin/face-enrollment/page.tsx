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
import { EmptyState } from "@/components/ui/states";
import { StatsCard } from "@/components/ui/stats-card";
import { apiFetch } from "@/lib/api";
import { ScanFace, Search, CheckCircle2, AlertCircle, RefreshCw, RotateCcw, ShieldCheck, Users, Lock } from "lucide-react";

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
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {actionError}
            </div>
          )}

          {/* Privacy & Security Notice Banner */}
          <div className="rounded-xl bg-brand-900 text-white p-5 sm:p-6 border border-brand-800 relative overflow-hidden flex items-start gap-4">
            <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" />
            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <p className="eyebrow text-accent-500">Biometric data governance</p>
              <h4 className="text-sm font-semibold text-white">
                How face data is protected
              </h4>
              <p className="text-xs text-brand-100/75 leading-relaxed max-w-3xl">
                Camera images are processed on the student&apos;s device and never uploaded. Only a 128-number face signature is stored, encrypted with AES-256-GCM, and it is never returned by any API. Admins can see enrollment status and authorize re-enrollment, but cannot view biometric data.
              </p>
            </div>
          </div>

          {/* Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard title="Total Students" value={students.length} icon={<Users className="w-5 h-5" />} iconBg="bg-brand-50 text-brand-700" />
            <StatsCard title="Face Enrolled" value={enrolledCount} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-50 text-emerald-700" />
            <StatsCard title="Pending Enrollment" value={pendingCount} icon={<AlertCircle className="w-5 h-5" />} iconBg="bg-amber-50 text-amber-700" />
          </div>

          {/* Face Directory Table */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <p className="eyebrow text-brand-600 mb-0.5">Enrollment register</p>
                <CardTitle className="flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-brand-600" />
                  <span>Student Biometric Status Directory</span>
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                    setIsLoading(true);
                    fetchStudents();
                  }} className="text-xs gap-1.5 self-start sm:self-center shrink-0">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </CardHeader>

            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center flex-wrap gap-2 sm:gap-3">
              <div className="w-full sm:flex-1 sm:min-w-56 sm:max-w-sm">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white text-sm"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
              >
                <option value="">All Enrollment Statuses</option>
                <option value="true">Enrolled Only</option>
                <option value="false">Pending Only</option>
              </select>
            </div>

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
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Auditing face enrollment states...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={ScanFace} title="No students found." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">
                            {student.studentId}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-40">
                            <p className="font-semibold text-brand-950 text-xs">{student.name}</p>
                            <p className="text-[11px] text-slate-500">{student.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">{student.rollNumber}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">{student.className}</TableCell>
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
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 whitespace-nowrap">
                            {student.isFaceEnrolled && <Lock className="w-3 h-3 text-brand-600" />}
                            {student.isFaceEnrolled ? "Encrypted (AES-256-GCM)" : "None"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {student.isFaceEnrolled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmTarget({ id: student._id, name: student.name })}
                              className="text-xs gap-1 whitespace-nowrap hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Re-Authorize
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 italic whitespace-nowrap">Awaiting Student</span>
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
