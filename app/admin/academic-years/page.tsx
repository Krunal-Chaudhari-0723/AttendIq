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
import { Calendar, Plus, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface AcademicYearItem {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  description?: string;
}

export default function AdminAcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    isActive: false,
    description: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchYears = async () => {
    try {
      const res = await apiFetch<{ academicYears: AcademicYearItem[] }>("/admin/academic-years");
      if (res.success && res.data) {
        setAcademicYears(res.data.academicYears);
      }
    } catch (err) {
      console.error("Failed to load academic years:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const res = await apiFetch("/admin/academic-years", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    setFormSubmitting(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        startDate: "2026-07-01",
        endDate: "2027-06-30",
        isActive: false,
        description: "",
      });
      setActionSuccess("Academic year added successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchYears();
    } else {
      setFormError(res.error || "Failed to create academic year");
    }
  };

  const handleActivateYear = async (id: string, name: string) => {
    const res = await apiFetch(`/admin/academic-years/${id}/activate`, {
      method: "PATCH",
    });

    if (res.success) {
      setActionSuccess(`Academic Year ${name} is now the active academic period.`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchYears();
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Academic Year Management"
        subtitle="Configure institutional session cycles and enforce active term policies"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {actionSuccess}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <h3 className="eyebrow text-brand-600 mb-0.5">Academic Sessions</h3>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span>Academic Session Calendar</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Only one academic session can remain active at a time</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => {
                    setIsLoading(true);
                    fetchYears();
                  }} className="text-xs gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Academic Year
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading sessions...
                      </TableCell>
                    </TableRow>
                  ) : academicYears.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState icon={Calendar} title="No academic years configured." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    academicYears.map((year) => (
                      <TableRow key={year._id} className={year.isActive ? "bg-emerald-50/40" : undefined}>
                        <TableCell>
                          <Badge variant="brand" size="sm" className="font-mono">
                            {year.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap">{new Date(year.startDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap">{new Date(year.endDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs text-slate-500 min-w-40">{year.description || "Regular Session"}</TableCell>
                        <TableCell>
                          {year.isActive ? (
                            <Badge variant="success" size="sm" className="gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Session
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Archived / Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!year.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleActivateYear(year._id, year.name)}
                              className="text-xs whitespace-nowrap"
                            >
                              Set as Active
                            </Button>
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

        {/* Create Academic Year Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Academic Year"
          subtitle="Configure new term period and activate if required"
        >
          {formError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateYear} className="space-y-5">
            <div className="space-y-3">
              <p className="eyebrow text-brand-600">Session period</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Academic Year Title *</label>
                <Input
                  required
                  placeholder="e.g. 2026-2027"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Start Date *</label>
                  <Input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">End Date *</label>
                  <Input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <Input
                  placeholder="e.g. Regular Academic Year"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:border-brand-200">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded bg-slate-100 border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-px accent-brand-700"
                />
                <span className="text-xs text-slate-700 font-medium">Set as currently active academic year</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                {formSubmitting ? "Saving..." : "Save Academic Year"}
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
