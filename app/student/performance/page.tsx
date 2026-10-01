"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LabeledBars } from "@/components/charts/LabeledBars";
import { Award, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Quiz {
  _id: string;
  quizTitle: string;
  subjectName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  dateTaken: string;
}
interface AssignmentRow {
  _id: string;
  title: string;
  subjectName: string;
  dueDate: string;
  obtainedMarks?: number;
  totalMarks: number;
  status: string;
  feedback?: string;
}

const assignmentVariant = (a: AssignmentRow) =>
  a.status === "GRADED" || a.status === "SUBMITTED" ? "success" : a.status === "LATE" ? "warning" : new Date(a.dueDate) < new Date() ? "danger" : "info";
const assignmentLabel = (a: AssignmentRow) => (a.status === "PENDING" ? (new Date(a.dueDate) < new Date() ? "OVERDUE" : "DUE") : a.status);

export default function StudentPerformancePage() {
  const [data, setData] = useState<{ quizzes: Quiz[]; assignments: AssignmentRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ quizzes: Quiz[]; assignments: AssignmentRow[] }>("/student/performance").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error || "Could not load your performance.");
    });
  }, []);

  const bySubject = new Map<string, number[]>();
  for (const q of data?.quizzes ?? []) bySubject.set(q.subjectName, [...(bySubject.get(q.subjectName) ?? []), q.percentage]);

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title="Academic Performance" subtitle="Your quiz results and assignments as recorded by your teachers" defaultRole="STUDENT">
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
          {!data && !error && (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" /> Loading…
            </div>
          )}
          {data && (
            <>
              {bySubject.size > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Quiz average by subject</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabeledBars
                      data={[...bySubject.entries()].map(([subject, v]) => ({ label: subject, value: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }))}
                      suffix="%"
                      valueName="Quiz average"
                    />
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Award className="w-4 h-4 text-amber-500" /> Quiz results (25% of engagement)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quiz</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.quizzes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-6">
                            No quiz results recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.quizzes.map((q) => (
                          <TableRow key={q._id}>
                            <TableCell className="font-semibold text-xs text-slate-900">{q.quizTitle}</TableCell>
                            <TableCell className="text-xs">{q.subjectName}</TableCell>
                            <TableCell className="text-xs text-slate-500">{formatDate(q.dateTaken)}</TableCell>
                            <TableCell className="text-xs font-mono font-bold">
                              {q.score} / {q.totalMarks} ({q.percentage}%)
                            </TableCell>
                            <TableCell>
                              <Badge variant={q.percentage >= 60 ? "success" : q.percentage >= 50 ? "warning" : "danger"} size="sm">
                                {q.percentage >= 60 ? "On target" : q.percentage >= 50 ? "Below target" : "Below pass mark"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <FileText className="w-4 h-4 text-blue-500" /> Assignments (20% of engagement)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.assignments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-slate-500 py-6">
                            No assignments recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.assignments.map((a) => (
                          <TableRow key={a._id}>
                            <TableCell className="text-xs">
                              <p className="font-semibold text-slate-900">{a.title}</p>
                              {a.feedback && <p className="text-slate-400">{a.feedback}</p>}
                            </TableCell>
                            <TableCell className="text-xs">{a.subjectName}</TableCell>
                            <TableCell className="text-xs text-slate-500">{formatDate(a.dueDate)}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-800">{a.obtainedMarks !== undefined && a.obtainedMarks !== null ? `${a.obtainedMarks} / ${a.totalMarks}` : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={assignmentVariant(a)} size="sm">
                                {assignmentLabel(a)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
