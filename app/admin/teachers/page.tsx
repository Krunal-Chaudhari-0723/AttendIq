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
import { GraduationCap, Search, Plus, RefreshCw, CheckCircle, XCircle } from "lucide-react";

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
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
                ✕
              </button>
            </div>
          )}

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Input
                icon={<Search className="w-4 h-4 text-slate-400" />}
                placeholder="Search teachers by name, ID, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
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
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Teacher
              </Button>
            </div>
          </div>

          {/* Teachers Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Faculty Directory</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {teachers.length} faculty members registered in system
                </p>
              </div>
            </CardHeader>
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
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading faculty directory...
                      </TableCell>
                    </TableRow>
                  ) : teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        No faculty found matching the query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher._id}>
                        <TableCell className="font-mono text-xs font-bold text-slate-700">
                          {teacher.teacherId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{teacher.name}</p>
                            <p className="text-[11px] text-slate-400">{teacher.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium text-slate-800">{teacher.designation}</p>
                          <p className="text-[11px] text-slate-400">{teacher.department}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? (
                              teacher.assignedClasses.map((c) => (
                                <Badge key={c._id} variant="purple" size="sm">
                                  {c.code || c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
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
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                            title={teacher.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            {teacher.status === "ACTIVE" ? (
                              <XCircle className="w-4 h-4 text-slate-400 hover:text-rose-600" />
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
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateTeacher} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Teacher ID *</label>
                <Input
                  required
                  placeholder="e.g. T203"
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value.toUpperCase() })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <Input
                  placeholder="+91 98765 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <Input
                required
                placeholder="Prof. Name"
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
                placeholder="teacher@attendiq.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Designation</label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Department</label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Input
                type="password"
                placeholder="Default: Teacher@123456"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="text-xs"
              />
              <p className="text-[10px] text-slate-400">Creates an active teacher account for portal login.</p>
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
                {formSubmitting ? "Saving..." : "Save Teacher"}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
