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
import { BookOpen, Plus, RefreshCw, Users, CheckCircle, AlertTriangle } from "lucide-react";

interface ClassItem {
  _id: string;
  name: string;
  code: string;
  division: string;
  department: string;
  semester: number;
  academicYear: string;
  studentCount: number;
  classTeacher?: { _id: string; name: string; teacherId: string };
  isActive: boolean;
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    division: "A",
    department: "Computer Science & Applications",
    semester: 2,
    academicYear: "2025-2026",
    studentCount: 30,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      const res = await apiFetch<{ classes: ClassItem[] }>("/admin/classes");
      if (res.success && res.data) {
        setClasses(res.data.classes);
      }
    } catch (err) {
      console.error("Failed to load classes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const res = await apiFetch("/admin/classes", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setFormSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        code: "",
        division: "A",
        department: "Computer Science & Applications",
        semester: 2,
        academicYear: "2025-2026",
        studentCount: 30,
      });
      setActionSuccess("Class created successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchClasses();
    } else {
      setFormError(res.error || "Failed to create class");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Class & Division Management"
        subtitle="Configure classes, divisions, semesters, and class teacher allocations"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              {actionSuccess}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <h3 className="eyebrow text-brand-600 mb-0.5">Academic Divisions</h3>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-600" />
                  <span>Active Classes & Cohorts</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Manage class codes and student capacities</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => {
                    setIsLoading(true);
                    fetchClasses();
                  }} className="text-xs gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Class
                </Button>
              </div>
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
                    <TableHead>Class Teacher</TableHead>
                    <TableHead>Enrolled Students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading classes...
                      </TableCell>
                    </TableRow>
                  ) : classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={BookOpen} title="No classes configured yet." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((cls) => (
                      <TableRow key={cls._id}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">
                            {cls.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-brand-950 whitespace-nowrap">{cls.name}</TableCell>
                        <TableCell>
                          <Badge variant="neutral" size="sm">
                            Div {cls.division}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 whitespace-nowrap">Semester {cls.semester}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-600 whitespace-nowrap">{cls.academicYear}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {cls.classTeacher?.name ? (
                            <span className="font-medium text-slate-800">{cls.classTeacher.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-brand-950 font-semibold tabular-nums whitespace-nowrap">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cls.studentCount ?? 0} Students</span>
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

        {/* Create Class Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Create New Class"
          subtitle="Define class code, division, and semester"
        >
          {formError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateClass} className="space-y-5">
            <div className="space-y-3">
              <p className="eyebrow text-brand-600">Class identity</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Class Name *</label>
                  <Input
                    required
                    placeholder="e.g. MCA Sem 3"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Class Code *</label>
                  <Input
                    required
                    placeholder="e.g. MCA-3"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-5">
              <p className="eyebrow text-brand-600">Division &amp; capacity</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Division</label>
                  <Input
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value.toUpperCase() })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Semester</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Capacity</label>
                  <Input
                    type="number"
                    value={formData.studentCount}
                    onChange={(e) => setFormData({ ...formData, studentCount: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
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

            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                {formSubmitting ? "Creating..." : "Save Class"}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
