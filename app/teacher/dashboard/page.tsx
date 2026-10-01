"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { BookOpen, CheckCircle2, Activity, AlertTriangle, Radio, Play, RefreshCw, Award, FileText } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { apiFetch } from "@/lib/api";

interface TeacherDashboardData {
  teacher: {
    id: string;
    name: string;
    email: string;
    department: string;
    designation: string;
  };
  kpis: {
    activeClasses: number;
    todayAttendance: string;
    todayAttendanceNote: string;
    averageEngagement: string;
    atRiskStudents: number;
    studentCount: number;
  };
  activeSession: {
    id: string;
    subjectName: string;
    className: string;
    mode: string;
    room: string;
    startTime: string;
    endTime: string;
  } | null;
  activeSessionCount: number;
  highRisk: { studentId: string; name: string; reason: string }[];
  schedule: Array<{
    id: string;
    name: string;
    code: string;
    time: string;
    status: string;
    count: string;
    mode: string;
    room: string;
  }>;
  assignedClasses: Array<{ id: string; name: string; code: string; studentCount: number }>;
  taughtSubjects: Array<{ id: string; name: string; code: string; credits: number; classId: string }>;
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Action Modal States
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Quiz Form
  const [quizForm, setQuizForm] = useState({
    studentId: "",
    subjectId: "",
    quizTitle: "",
    score: 0,
    totalMarks: 100,
  });
  const [students, setStudents] = useState<{ studentId: string; name: string; className: string; classId?: string }[]>([]);

  // Assignment Form
  const [assignForm, setAssignForm] = useState({
    studentId: "",
    subjectId: "",
    title: "",
    obtainedMarks: 0,
    totalMarks: 100,
    feedback: "",
  });

  const fetchDashboard = () =>
    apiFetch<TeacherDashboardData>("/teacher/dashboard").then((res) => {
      setIsLoading(false);
      if (res.success && res.data) {
        const teacherData = res.data;
        setData(teacherData);
        if (teacherData.taughtSubjects.length > 0) {
          setQuizForm((prev) => (prev.subjectId ? prev : { ...prev, subjectId: teacherData.taughtSubjects[0].id }));
          setAssignForm((prev) => (prev.subjectId ? prev : { ...prev, subjectId: teacherData.taughtSubjects[0].id }));
        }
      }
    });

  useEffect(() => {
    fetchDashboard();
    apiFetch<{ students: { studentId: string; name: string; className: string }[] }>("/teacher/students").then((res) => {
      if (res.success && res.data) setStudents(res.data.students);
    });
  }, []);

  // Students eligible for the selected subject (same class)
  const classOf = (subjectId: string) => data?.taughtSubjects.find((t) => t.id === subjectId)?.classId;
  const classNameOf = (subjectId: string) => data?.assignedClasses.find((c) => c.id === classOf(subjectId))?.name;
  const eligible = (subjectId: string) => students.filter((st) => !subjectId || st.className === classNameOf(subjectId));

  const handleRecordQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const res = await apiFetch("/teacher/quiz-results", {
      method: "POST",
      body: JSON.stringify(quizForm),
    });

    if (res.success) {
      setIsQuizModalOpen(false);
      setActionSuccess("Quiz grade recorded successfully!");
      setTimeout(() => setActionSuccess(null), 3500);
      fetchDashboard();
    } else {
      setActionError(res.error || "Failed to record quiz");
    }
  };

  const handleRecordAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const res = await apiFetch("/teacher/assignments", {
      method: "POST",
      body: JSON.stringify(assignForm),
    });

    if (res.success) {
      setIsAssignmentModalOpen(false);
      setActionSuccess("Assignment evaluation recorded successfully!");
      setTimeout(() => setActionSuccess(null), 3500);
      fetchDashboard();
    } else {
      setActionError(res.error || "Failed to record assignment");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["TEACHER"]}>
      <AppShell
        title={data ? `Welcome ${data.teacher.name}` : "Welcome Faculty"}
        subtitle="Manage class attendance sessions, grade academic assessments, and monitor engagement"
        defaultRole="TEACHER"
      >
        <div className="space-y-6">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-fadeIn flex items-center justify-between">
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess(null)}>✕</button>
            </div>
          )}

          {/* Quick Action Bar to Start Attendance Session & Academic Entry */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span>
                  {data?.activeSession
                    ? `Live Session Active: ${data.activeSession.subjectName}`
                    : "Ready to start today's attendance session?"}
                </span>
              </h3>
              <p className="text-xs text-indigo-200">
                {data?.activeSession
                  ? `${data.activeSession.className} • ${data.activeSession.mode} • Room: ${data.activeSession.room}${data.activeSessionCount > 1 ? ` • ${data.activeSessionCount} sessions live` : ""}`
                  : "Start a physical (campus + face + liveness) or remote (face + liveness) session for your class."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsQuizModalOpen(true)}
                className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700 text-xs gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" /> Enter Quiz
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignmentModalOpen(true)}
                className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700 text-xs gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" /> Enter Grade
              </Button>
              <Link href="/teacher/live-attendance">
                <Button variant="success" size="sm" className="font-semibold shadow-md gap-1.5 text-xs">
                  <Play className="w-3.5 h-3.5" /> {data?.activeSession ? "Monitor Live" : "Start Session"}
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Classes"
              value={data ? String(data.kpis.activeClasses) : "..."}
              description={data ? `${data.kpis.studentCount} active students` : undefined}
              icon={<BookOpen className="w-5 h-5" />}
              iconBg="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Today's Attendance"
              value={data ? data.kpis.todayAttendance : "..."}
              description={data?.kpis.todayAttendanceNote}
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <StatsCard
              title="Average Engagement"
              value={data ? data.kpis.averageEngagement : "..."}
              description="Last 30 days, weighted formula"
              icon={<Activity className="w-5 h-5" />}
              iconBg="bg-blue-50 text-blue-600"
            />
            <StatsCard
              title="At-Risk Students"
              value={data ? String(data.kpis.atRiskStudents) : "..."}
              description="Medium or high risk indicator"
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Teaching Schedule Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Today&apos;s Sessions</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Sessions you started or scheduled today, with live turnout</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                  setIsLoading(true);
                  fetchDashboard();
                }} className="text-xs gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Subject</TableHead>
                    <TableHead>Class / Division</TableHead>
                    <TableHead>Time Window</TableHead>
                    <TableHead>Turnout</TableHead>
                    <TableHead>Session Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading faculty schedule...
                      </TableCell>
                    </TableRow>
                  ) : (data?.schedule || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                        No sessions today. Start one from Live Attendance.
                      </TableCell>
                    </TableRow>
                  ) : (data?.schedule || []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-slate-900 text-xs">{c.name}</TableCell>
                      <TableCell className="text-xs">{c.code}</TableCell>
                      <TableCell className="font-mono text-xs">{c.time}</TableCell>
                      <TableCell className="text-xs">{c.count}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            c.status === "Active Session"
                              ? "success"
                              : c.status === "Scheduled"
                              ? "purple"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href="/teacher/live-attendance">
                          <Button size="sm" variant={c.status === "Active Session" ? "primary" : "outline"} className="text-xs">
                            {c.status === "Active Session" ? "Monitor Live" : "View Session"}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Enter Quiz Modal */}
        <Modal
          isOpen={isQuizModalOpen}
          onClose={() => setIsQuizModalOpen(false)}
          title="Enter Student Quiz Result"
          subtitle="Record evaluation score (25% weighting towards engagement score)"
        >
          {actionError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}
          <form onSubmit={handleRecordQuiz} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Student ID *</label>
                <select
                  required
                  value={quizForm.studentId}
                  onChange={(e) => setQuizForm({ ...quizForm, studentId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                >
                  <option value="">Select student</option>
                  {eligible(quizForm.subjectId).map((st) => (
                    <option key={st.studentId} value={st.studentId}>
                      {st.name} ({st.studentId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Subject Course *</label>
                <select
                  required
                  value={quizForm.subjectId}
                  onChange={(e) => setQuizForm({ ...quizForm, subjectId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Subject</option>
                  {(data?.taughtSubjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Quiz Title *</label>
              <Input
                required
                value={quizForm.quizTitle}
                onChange={(e) => setQuizForm({ ...quizForm, quizTitle: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Obtained Score *</label>
                <Input
                  type="number"
                  required
                  min="0"
                  max={quizForm.totalMarks}
                  value={quizForm.score}
                  onChange={(e) => setQuizForm({ ...quizForm, score: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Total Marks</label>
                <Input
                  type="number"
                  value={quizForm.totalMarks}
                  onChange={(e) => setQuizForm({ ...quizForm, totalMarks: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsQuizModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save Quiz Grade
              </Button>
            </div>
          </form>
        </Modal>

        {/* Enter Assignment Modal */}
        <Modal
          isOpen={isAssignmentModalOpen}
          onClose={() => setIsAssignmentModalOpen(false)}
          title="Grade Student Assignment"
          subtitle="Record submission score (20% weighting towards engagement score)"
        >
          {actionError && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}
          <form onSubmit={handleRecordAssignment} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Student ID *</label>
                <select
                  required
                  value={assignForm.studentId}
                  onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                >
                  <option value="">Select student</option>
                  {eligible(assignForm.subjectId).map((st) => (
                    <option key={st.studentId} value={st.studentId}>
                      {st.name} ({st.studentId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Subject Course *</label>
                <select
                  required
                  value={assignForm.subjectId}
                  onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Subject</option>
                  {(data?.taughtSubjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Assignment Title *</label>
              <Input
                required
                value={assignForm.title}
                onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Marks Obtained</label>
                <Input
                  type="number"
                  min="0"
                  max={assignForm.totalMarks}
                  value={assignForm.obtainedMarks}
                  onChange={(e) => setAssignForm({ ...assignForm, obtainedMarks: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Total Marks</label>
                <Input
                  type="number"
                  value={assignForm.totalMarks}
                  onChange={(e) => setAssignForm({ ...assignForm, totalMarks: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Instructor Feedback</label>
              <Input
                value={assignForm.feedback}
                onChange={(e) => setAssignForm({ ...assignForm, feedback: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignmentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save Assignment Evaluation
              </Button>
            </div>
          </form>
        </Modal>
      </AppShell>
    </ProtectedRoute>
  );
}
