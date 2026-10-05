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
import { apiFetch } from "@/lib/api";
import { Users, Search, Plus, CheckCircle, XCircle, ScanFace, Eye, RefreshCw, AlertTriangle, RotateCcw } from "lucide-react";

interface StudentItem {
  _id: string;
  studentId: string;
  name: string;
  email: string;
  rollNumber: string;
  className: string;
  department: string;
  academicYear: string;
  isFaceEnrolled: boolean;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

interface StudentDetailView {
  student: StudentItem;
  engagement?: { overallScore: number | null; components: Record<string, number | null> };
  risk?: { riskLevel: string; reasons: string[]; attendanceRate: number | null };
  attendanceHistory?: { status: string; markedAt: string; sessionId?: { subjectName?: string } | null }[];
  faceProfile?: { enrolled: boolean; enrolledAt?: string; modelVersion?: string };
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [faceFilter, setFaceFilter] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form state
  const emptyForm = { studentId: "", name: "", email: "", rollNumber: "", classId: "", password: "" };
  const [formData, setFormData] = useState(emptyForm);
  const [total, setTotal] = useState(0);
  const [classOptions, setClassOptions] = useState<{ _id: string; name: string; division?: string; academicYear: string; studentCount?: number }[]>([]);

  useEffect(() => {
    apiFetch<{ classes: { _id: string; name: string; division?: string; academicYear: string; studentCount?: number }[] }>("/admin/classes").then((res) => {
      if (res.success && res.data) setClassOptions(res.data.classes);
    });
  }, []);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      let query = "/admin/students?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) query += `status=${encodeURIComponent(statusFilter)}&`;
      if (faceFilter) query += `isFaceEnrolled=${encodeURIComponent(faceFilter)}&`;

      const res = await apiFetch<{ students: StudentItem[]; total: number }>(`${query}limit=500`);
      if (res.success && res.data) {
        setStudents(res.data.students);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, statusFilter, faceFilter]);

  const handleOpenDetail = async (id: string) => {
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiFetch<StudentDetailView>(`/admin/students/${id}`);
      if (res.success && res.data) {
        setSelectedStudent(res.data);
      }
    } catch (err) {
      console.error("Failed to load student details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const res = await apiFetch("/admin/students", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setFormSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData(emptyForm);
      setActionSuccess("Student registered successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchStudents();
    } else {
      setFormError(res.error || "Failed to create student");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await apiFetch(`/admin/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.success) {
      setActionSuccess(`Student marked as ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchStudents();
    }
  };

  const handleAuthorizeReEnrollment = async (id: string) => {
    const res = await apiFetch(`/admin/students/${id}/face-status`, {
      method: "PATCH",
      body: JSON.stringify({ reAuthorize: true }),
    });

    if (res.success) {
      setActionSuccess(res.message || "Re-enrollment authorized. Biometrics purged.");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchStudents();
      if (selectedStudent) {
        handleOpenDetail(id);
      }
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Student Management"
        subtitle="Manage student enrollment, class assignments, and face verification permissions"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-3 animate-fadeIn">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                {actionSuccess}
              </span>
              <button onClick={() => setActionSuccess(null)} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 shrink-0">
                ✕
              </button>
            </div>
          )}

          {/* Students register */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <p className="eyebrow text-brand-600 mb-0.5">Student register</p>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-600" />
                  <span>Enrolled Students</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Showing {students.length}
                  {total > students.length ? ` of ${total}` : ""} students — refine the search to narrow the list
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoading(true);
                    fetchStudents();
                  }}
                  className="text-xs gap-1.5"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Student
                </Button>
              </div>
            </CardHeader>

            {/* Search & filter toolbar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center flex-wrap gap-2 sm:gap-3">
              <div className="w-full sm:flex-1 sm:min-w-56 sm:max-w-sm">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search by name, roll, student ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white text-sm"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              <select
                value={faceFilter}
                onChange={(e) => setFaceFilter(e.target.value)}
                className="w-full sm:w-auto h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
              >
                <option value="">All Face Status</option>
                <option value="true">Face Enrolled</option>
                <option value="false">Pending Enrollment</option>
              </select>
            </div>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Class / Division</TableHead>
                    <TableHead>Face Enrollment</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading student database...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={Users} title="No students matching the selected criteria." />
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
                          <div className="flex items-center gap-2.5 min-w-44">
                            <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-semibold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-brand-950 text-xs">{student.name}</p>
                              <p className="text-[11px] text-slate-500">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                          {student.rollNumber}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                          {student.className}
                        </TableCell>
                        <TableCell>
                          {student.isFaceEnrolled ? (
                            <Badge variant="success" size="sm" className="gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Enrolled
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" className="gap-1">
                              <XCircle className="w-3 h-3 text-amber-600" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={student.status === "ACTIVE" ? "success" : "neutral"}
                            size="sm"
                          >
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDetail(student._id)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-brand-700 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                              title="View Full Profile & Attendance"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAuthorizeReEnrollment(student._id)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-amber-700 hover:border-amber-200 hover:bg-amber-50 transition-colors"
                              title="Authorize Face Re-Enrollment"
                            >
                              <ScanFace className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(student._id, student.status)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                              title={student.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            >
                              {student.status === "ACTIVE" ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Create Student Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Register New Student"
          subtitle="Add student record to MongoDB and configure enrollment parameters"
        >
          {formError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateStudent} className="space-y-5">
            <div className="space-y-3">
              <p className="eyebrow text-brand-600">Student details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Student ID *</label>
                  <Input
                    required
                    placeholder="e.g. S108"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value.toUpperCase() })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Roll Number *</label>
                  <Input
                    required
                    placeholder="e.g. MCA-2025-08"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <Input
                  required
                  placeholder="Student Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                <Input
                  type="email"
                  required
                  placeholder="student@attendiq.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-5">
              <p className="eyebrow text-brand-600">Class &amp; portal access</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Class / Division *</label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                  >
                    <option value="">Select class</option>
                    {classOptions.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.division ? ` (Div ${c.division})` : ""} — {c.studentCount ?? 0} students
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                  <Input readOnly value={classOptions.find((c) => c._id === formData.classId)?.academicYear ?? "Set by class"} className="text-sm bg-slate-50 text-slate-600" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Portal Password (Optional)</label>
                <Input
                  type="password"
                  placeholder="8+ characters with letters and numbers"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-500 leading-snug">If set, a login account is created. Leave empty to add the student to the roster without portal access.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={formSubmitting}
                className="text-xs"
              >
                {formSubmitting ? "Creating..." : "Save Student"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Student Details & Academic Signals Modal */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedStudent?.student.name || "Student Profile"}
          subtitle={`${selectedStudent?.student.studentId} • ${selectedStudent?.student.className}`}
          maxWidth="lg"
        >
          {detailLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
              Loading student academic profile...
            </div>
          ) : selectedStudent ? (
            <div className="space-y-5">
              {/* Profile Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                <div className="bg-white p-3">
                  <span className="eyebrow">Roll No.</span>
                  <p className="text-xs font-semibold text-brand-950 mt-1 font-mono">{selectedStudent.student.rollNumber}</p>
                </div>
                <div className="bg-white p-3">
                  <span className="eyebrow">Face Enrolled</span>
                  <p className="mt-1">
                    <Badge variant={selectedStudent.student.isFaceEnrolled ? "success" : "warning"} size="sm">
                      {selectedStudent.student.isFaceEnrolled ? "Verified" : "Pending"}
                    </Badge>
                  </p>
                </div>
                <div className="bg-white p-3">
                  <span className="eyebrow">Engagement</span>
                  <p className="text-xs font-semibold text-brand-700 mt-1 tabular-nums">
                    {selectedStudent.engagement?.overallScore != null ? `${selectedStudent.engagement.overallScore} / 100` : "Not enough data"}
                  </p>
                </div>
                <div className="bg-white p-3">
                  <span className="eyebrow">Risk Level</span>
                  <p className="mt-1">
                    <Badge
                      variant={
                        selectedStudent.risk?.riskLevel === "HIGH"
                          ? "danger"
                          : selectedStudent.risk?.riskLevel === "MEDIUM"
                          ? "warning"
                          : "success"
                      }
                      size="sm"
                    >
                      {selectedStudent.risk?.riskLevel === "UNKNOWN" || !selectedStudent.risk ? "NO DATA" : selectedStudent.risk.riskLevel}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* Risk Reasons if any */}
              {selectedStudent.risk?.reasons && selectedStudent.risk.reasons.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-1.5 text-amber-900 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Explainable Risk Factor:</span>
                  </div>
                  <ul className="mt-1.5 list-disc list-inside text-xs text-amber-900 space-y-0.5">
                    {selectedStudent.risk.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Face Enrollment Security Administration */}
              <div className="p-4 rounded-lg border border-brand-100 bg-brand-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-brand-950 flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-brand-600" /> Biometric Face Profile Management
                  </p>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {selectedStudent.student.isFaceEnrolled
                      ? "Encrypted 128-number face signature (AES-256-GCM). Camera images are never uploaded."
                      : "No face embedding captured yet."}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAuthorizeReEnrollment(selectedStudent.student._id)}
                  className="text-xs gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Authorize Re-Enrollment
                </Button>
              </div>

              {/* Recent Attendance Records */}
              <div>
                <h4 className="text-sm font-semibold text-brand-950 mb-2">Recent Attendance Sessions</h4>
                {selectedStudent.attendanceHistory && selectedStudent.attendanceHistory.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {selectedStudent.attendanceHistory.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-700 min-w-0 truncate">{rec.sessionId?.subjectName || "Subject Session"}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500 text-[11px] tabular-nums">{new Date(rec.markedAt).toLocaleDateString()}</span>
                          <Badge variant={rec.status === "PRESENT" ? "success" : "danger"} size="sm">
                            {rec.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No session attendance records logged yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
