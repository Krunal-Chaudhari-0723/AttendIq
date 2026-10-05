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
import { Plus, RefreshCw, Award, CheckCircle, AlertTriangle } from "lucide-react";

interface SubjectItem {
  _id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
  totalHours: number;
  semester: number;
  classId?: { _id: string; name: string; code: string };
  teacherId?: { _id: string; name: string; teacherId: string };
}

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<{ _id: string; name: string; code: string; division?: string }[]>([]);
  const [teachers, setTeachers] = useState<{ _id: string; name: string; teacherId: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    classId: "",
    teacherId: "",
    credits: 4,
    totalHours: 45,
    semester: 2,
    department: "Computer Science & Applications",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resSubj, resClass, resTeach] = await Promise.all([
        apiFetch<{ subjects: SubjectItem[] }>("/admin/subjects"),
        apiFetch<{ classes: { _id: string; name: string; code: string; division?: string }[] }>("/admin/classes"),
        apiFetch<{ teachers: { _id: string; name: string; teacherId: string }[] }>("/admin/teachers"),
      ]);

      if (resSubj.success && resSubj.data) setSubjects(resSubj.data.subjects);
      if (resClass.success && resClass.data?.classes) {
        const classList = resClass.data.classes;
        setClasses(classList);
        if (classList.length > 0 && !formData.classId) {
          setFormData((prev) => ({ ...prev, classId: classList[0]._id }));
        }
      }
      if (resTeach.success && resTeach.data) setTeachers(resTeach.data.teachers);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const res = await apiFetch("/admin/subjects", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setFormSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        code: "",
        classId: classes[0]?._id || "",
        teacherId: "",
        credits: 4,
        totalHours: 45,
        semester: 2,
        department: "Computer Science & Applications",
      });
      setActionSuccess("Subject created successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } else {
      setFormError(res.error || "Failed to create subject");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Subject Management"
        subtitle="Configure academic curriculum, credit hours, and assign course faculty"
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
                <h3 className="eyebrow text-brand-600 mb-0.5">Academic Subjects</h3>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-600" />
                  <span>Curriculum Directory</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Curriculum courses and allocated teaching staff</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => {
                    setIsLoading(true);
                    fetchData();
                  }} className="text-xs gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Code</TableHead>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Target Class</TableHead>
                    <TableHead>Course Faculty</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Total Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading curriculum...
                      </TableCell>
                    </TableRow>
                  ) : subjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState icon={Award} title="No subjects created yet." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    subjects.map((subj) => (
                      <TableRow key={subj._id}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">
                            {subj.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-brand-950 min-w-44">{subj.name}</TableCell>
                        <TableCell>
                          <Badge variant="neutral" size="sm">
                            {subj.classId?.name || "General"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {subj.teacherId?.name ? (
                            <span className="font-medium text-slate-800">{subj.teacherId.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-brand-950 tabular-nums whitespace-nowrap">{subj.credits} Credits</TableCell>
                        <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">{subj.totalHours} Hours</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Create Subject Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Subject"
          subtitle="Define subject code, assign class and select faculty instructor"
        >
          {formError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateSubject} className="space-y-5">
            <div className="space-y-3">
              <p className="eyebrow text-brand-600">Course details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Subject Name *</label>
                  <Input
                    required
                    placeholder="e.g. Cloud Computing"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Subject Code *</label>
                  <Input
                    required
                    placeholder="e.g. CS601"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-5">
              <p className="eyebrow text-brand-600">Allocation</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Assign to Class *</label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Course Faculty</label>
                  <select
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                  >
                    <option value="">Select Teacher (Optional)</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.teacherId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Credits</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Total Hours</label>
                  <Input
                    type="number"
                    value={formData.totalHours}
                    onChange={(e) => setFormData({ ...formData, totalHours: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                {formSubmitting ? "Saving..." : "Save Subject"}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
