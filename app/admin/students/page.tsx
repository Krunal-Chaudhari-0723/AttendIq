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
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
                ✕
              </button>
            </div>
          )}

          {/* Action Header & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search by name, roll, student ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white text-xs h-9"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              <select
                value={faceFilter}
                onChange={(e) => setFaceFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Face Status</option>
                <option value="true">Face Enrolled</option>
                <option value="false">Pending Enrollment</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
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
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Student
              </Button>
            </div>
          </div>

          {/* Students Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Enrolled Students</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {students.length}
                  {total > students.length ? ` of ${total}` : ""} students — refine the search to narrow the list
                </p>
              </div>
            </CardHeader>
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
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading student database...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        No students matching the selected criteria.
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
                        <TableCell className="font-mono text-xs text-slate-600">
                          {student.rollNumber}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
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
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="View Full Profile & Attendance"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAuthorizeReEnrollment(student._id)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Authorize Face Re-Enrollment"
                            >
                              <ScanFace className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(student._id, student.status)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
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
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Student ID *</label>
                <Input
                  required
                  placeholder="e.g. S108"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value.toUpperCase() })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Roll Number *</label>
                <Input
                  required
                  placeholder="e.g. MCA-2025-08"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <Input
                required
                placeholder="Student Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email Address *</label>
              <Input
                type="email"
                required
                placeholder="student@attendiq.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Class / Division *</label>
                <select
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                <Input readOnly value={classOptions.find((c) => c._id === formData.classId)?.academicYear ?? "Set by class"} className="text-xs bg-slate-50" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Portal Password (Optional)</label>
              <Input
                type="password"
                placeholder="8+ characters with letters and numbers"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="text-xs"
              />
              <p className="text-[10px] text-slate-400">If set, a login account is created. Leave empty to add the student to the roster without portal access.</p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
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
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
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
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading student academic profile...
            </div>
          ) : selectedStudent ? (
            <div className="space-y-5">
              {/* Profile Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Roll No.</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{selectedStudent.student.rollNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Face Enrolled</span>
                  <p className="mt-0.5">
                    <Badge variant={selectedStudent.student.isFaceEnrolled ? "success" : "warning"} size="sm">
                      {selectedStudent.student.isFaceEnrolled ? "Verified" : "Pending"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Engagement</span>
                  <p className="text-xs font-bold text-indigo-700 mt-0.5">
                    {selectedStudent.engagement?.overallScore != null ? `${selectedStudent.engagement.overallScore} / 100` : "Not enough data"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Risk Level</span>
                  <p className="mt-0.5">
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
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Explainable Risk Factor:</span>
                  </div>
                  <ul className="mt-1 list-disc list-inside text-xs text-amber-900 space-y-0.5">
                    {selectedStudent.risk.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Face Enrollment Security Administration */}
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-indigo-400" /> Biometric Face Profile Management
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedStudent.student.isFaceEnrolled
                      ? "Encrypted 128-number face signature (AES-256-GCM). Camera images are never uploaded."
                      : "No face embedding captured yet."}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAuthorizeReEnrollment(selectedStudent.student._id)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Authorize Re-Enrollment
                </Button>
              </div>

              {/* Recent Attendance Records */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">Recent Attendance Sessions</h4>
                {selectedStudent.attendanceHistory && selectedStudent.attendanceHistory.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedStudent.attendanceHistory.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-semibold text-slate-700">{rec.sessionId?.subjectName || "Subject Session"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">{new Date(rec.markedAt).toLocaleDateString()}</span>
                          <Badge variant={rec.status === "PRESENT" ? "success" : "danger"} size="sm">
                            {rec.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No session attendance records logged yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
