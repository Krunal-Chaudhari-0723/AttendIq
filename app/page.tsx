import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  MapPin,
  ScanFace,
  Activity,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Users,
  GraduationCap,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Top Bar */}
      <nav className="h-20 border-b border-slate-800/80 px-6 lg:px-12 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="font-bold text-2xl text-white tracking-tight">
              Attend<span className="text-indigo-400">IQ</span>
            </span>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              Smart Attendance Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white text-xs">
              Portal Sign In
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-500 text-xs shadow-md shadow-indigo-600/30">
              Launch Demo <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 lg:px-12 py-20 max-w-6xl mx-auto text-center space-y-8 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Single Source of Truth • Face AI + Location Verification + Academic Risk</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto">
          Smart Attendance & <br />
          <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
            Student Engagement System
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-normal">
          AttendIQ verifies student identity and physical campus presence before marking attendance, turns raw records into explainable engagement insights, and generates actionable AI recommendations.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link href="/admin/dashboard">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 gap-2">
              <ShieldAlert className="w-5 h-5" /> Explore Admin Portal
            </Button>
          </Link>
          <Link href="/teacher/dashboard">
            <Button size="lg" variant="outline" className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" /> Teacher Portal
            </Button>
          </Link>
          <Link href="/student/dashboard">
            <Button size="lg" variant="outline" className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Student Portal
            </Button>
          </Link>
        </div>

        {/* Core Value Pipeline Flow (PDF Page 4 Core Story) */}
        <div className="pt-16 max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6">
            Core Attendance & Engagement Pipeline
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-left">
            {[
              { step: "01", title: "Face AI", desc: "Identity Verified", icon: ScanFace, color: "text-indigo-400" },
              { step: "02", title: "Location", desc: "Campus Radius Bounds", icon: MapPin, color: "text-blue-400" },
              { step: "03", title: "Attendance", desc: "Trusted Entry", icon: CheckCircle2, color: "text-emerald-400" },
              { step: "04", title: "Engagement", desc: "Weighted Signals", icon: Activity, color: "text-purple-400" },
              { step: "05", title: "Academic Risk", desc: "Explainable Rules", icon: AlertTriangle, color: "text-amber-400" },
              { step: "06", title: "AI Actions", desc: "Timely Intervention", icon: Lightbulb, color: "text-sky-400" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">{s.step}</span>
                    <Icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-200">{s.title}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-400">
        <p>AttendIQ — Perfect Master Development Prompt Prototype • Phase 1 Foundation</p>
      </footer>
    </div>
  );
}
