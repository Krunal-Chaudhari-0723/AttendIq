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
import { GraduationCap, Search, Plus, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface TeacherItem {
  _id: string;
  teacherId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  phone?: string;
  assignedClasses?: Array<{ _id: string; name: string; code: string }>;
  subjectsTaught?: Array<{ _id: string; name: string; code: string }>;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    teacherId: "",
    name: "",
    email: "",
    department: "Computer Science & Applications",
    designation: "Associate Professor",
    phone: "",
    password: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchTeachers = async () => {
    try {
      let query = "/admin/teachers?";
      if (search) query += `search=${encodeURIComponent(search)}&`;

      const res = await apiFetch<{ teachers: TeacherItem[] }>(query);
      if (res.success && res.data) {
        setTeachers(res.data.teachers);
      }
    } catch (err) {
      console.error("Failed to load teachers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [search]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const res = await apiFetch("/admin/teachers", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setFormSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData({
        teacherId: "",
        name: "",
        email: "",
        department: "Computer Science & Applications",
        designation: "Associate Professor",
        phone: "",
        password: "",
      });
      setActionSuccess("Teacher registered successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchTeachers();
    } else {
      setFormError(res.error || "Failed to create teacher");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await apiFetch(`/admin/teachers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.success) {
      setActionSuccess(`Teacher status updated to ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchTeachers();
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Teacher Management"
        subtitle="Manage faculty directory, course allocations, and teaching credentials"
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

          {/* Faculty register */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <p className="eyebrow text-brand-600 mb-0.5">Faculty register</p>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-brand-600" />
                  <span>Faculty Directory</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Showing {teachers.length} faculty members registered in system
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoading(true);
                    fetchTeachers();
                  }}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Teacher
                </Button>
              </div>
            </CardHeader>

            {/* Search toolbar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center flex-wrap gap-2 sm:gap-3">
              <div className="w-full sm:flex-1 sm:min-w-56 sm:max-w-sm">
                <Input
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                  placeholder="Search teachers by name, ID, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white text-sm"
                />
              </div>
            </div>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher ID</TableHead>
                    <TableHead>Faculty Name</TableHead>
                    <TableHead>Designation & Department</TableHead>
                    <TableHead>Assigned Classes</TableHead>
                    <TableHead>Subjects Taught</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading faculty directory...
                      </TableCell>
                    </TableRow>
                  ) : teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={GraduationCap} title="No faculty found matching the query." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher._id}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">
                            {teacher.teacherId}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5 min-w-44">
                            <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-semibold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
                              {teacher.name.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, "").charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-brand-950 text-xs">{teacher.name}</p>
                              <p className="text-[11px] text-slate-500">{teacher.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-44">
                          <p className="text-xs font-medium text-slate-800">{teacher.designation}</p>
                          <p className="text-[11px] text-slate-500">{teacher.department}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? (
                              teacher.assignedClasses.map((c) => (
                                <Badge key={c._id} variant="brand" size="sm">
                                  {c.code || c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-40">
                          <div className="flex flex-wrap gap-1">
                            {teacher.subjectsTaught && teacher.subjectsTaught.length > 0 ? (
                              teacher.subjectsTaught.map((s) => (
                                <Badge key={s._id} variant="neutral" size="sm">
                                  {s.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">General</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={teacher.status === "ACTIVE" ? "success" : "neutral"}
                            size="sm"
                          >
                            {teacher.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => handleToggleStatus(teacher._id, teacher.status)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                            title={teacher.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            {teacher.status === "ACTIVE" ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Create Teacher Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Faculty Member"
          subtitle="Register teacher credentials and assign default department"
        >
          {formError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateTeacher} className="space-y-5">
            <div className="space-y-3">
              <p className="eyebrow text-brand-600">Faculty details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Teacher ID *</label>
                  <Input
                    required
                    placeholder="e.g. T203"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value.toUpperCase() })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Phone</label>
                  <Input
                    placeholder="+91 98765 00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <Input
                  required
                  placeholder="Prof. Name"
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
                  placeholder="teacher@attendiq.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-5">
              <p className="eyebrow text-brand-600">Appointment &amp; portal access</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Designation</label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <Input
                  type="password"
                  placeholder="Default: Teacher@123456"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-500">Creates an active teacher account for portal login.</p>
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
                {formSubmitting ? "Saving..." : "Save Teacher"}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
