import Link from "next/link";
import { Sparkles, MapPin, ScanFace, Activity, AlertTriangle, Lightbulb, ArrowRight, CheckCircle2, Users, GraduationCap, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BMU, BMUCrest, BMULogo } from "@/components/brand/BMUBrand";


export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-slate-900 font-sans flex flex-col">
      {/* Navigation Top Bar */}
      <nav className="sticky top-0 z-50 bg-brand-900 border-b-[3px] border-accent-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <BMULogo height={46} priority className="hidden md:block" />
            <BMUCrest height={40} priority className="md:hidden" />
            <span className="hidden md:block h-10 w-px bg-white/15" aria-hidden="true" />
            <div className="leading-tight min-w-0">
              <span className="font-semibold text-lg sm:text-xl text-white tracking-tight">
                Attend<span className="text-accent-500">IQ</span>
              </span>
              <p className="text-[10px] text-brand-100/75 font-medium tracking-wide uppercase">
                Smart Attendance Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 text-xs">
                Portal Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="accent" size="sm" className="text-xs">
                Launch Demo <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <section className="rounded-xl bg-brand-900 text-white p-6 sm:p-10 border border-brand-800 relative overflow-hidden space-y-6">
          <span className="absolute left-0 inset-y-0 w-1 bg-accent-500" aria-hidden="true" />
          <p className="eyebrow text-brand-100/75">{BMU.name} • {BMU.location}</p>

          <div className="inline-flex items-start gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/15 text-brand-100 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-accent-400 shrink-0" />
            <span>Single Source of Truth • Face AI + Location Verification + Academic Risk</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight max-w-3xl">
            Smart Attendance & <br />
            <span className="text-brand-200">
              Student Engagement System
            </span>
          </h1>

          <p className="text-sm sm:text-base text-brand-100/75 max-w-2xl leading-relaxed font-normal">
            AttendIQ verifies student identity and physical campus presence before marking attendance, turns raw records into explainable engagement insights, and generates actionable AI recommendations.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 pt-2">
            <Link href="/admin/dashboard">
              <Button size="lg" variant="accent" className="gap-2 w-full sm:w-auto">
                <ShieldAlert className="w-5 h-5" /> Explore Admin Portal
              </Button>
            </Link>
            <Link href="/teacher/dashboard">
              <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 gap-2 w-full sm:w-auto">
                <GraduationCap className="w-5 h-5 text-brand-200" /> Teacher Portal
              </Button>
            </Link>
            <Link href="/student/dashboard">
              <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 gap-2 w-full sm:w-auto">
                <Users className="w-5 h-5 text-brand-200" /> Student Portal
              </Button>
            </Link>
          </div>
        </section>

        {/* Core Value Pipeline Flow (PDF Page 4 Core Story) */}
        <section className="space-y-4">
          <h2 className="eyebrow text-brand-700">
            Core Attendance & Engagement Pipeline
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-left">
            {[
              { step: "01", title: "Face AI", desc: "Identity Verified", icon: ScanFace, color: "bg-brand-50 text-brand-700" },
              { step: "02", title: "Location", desc: "Campus Radius Bounds", icon: MapPin, color: "bg-brand-50 text-brand-700" },
              { step: "03", title: "Attendance", desc: "Trusted Entry", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
              { step: "04", title: "Engagement", desc: "Weighted Signals", icon: Activity, color: "bg-brand-50 text-brand-700" },
              { step: "05", title: "Academic Risk", desc: "Explainable Rules", icon: AlertTriangle, color: "bg-amber-50 text-amber-700" },
              { step: "06", title: "AI Actions", desc: "Timely Intervention", icon: Lightbulb, color: "bg-accent-50 text-accent-600" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-[var(--shadow-card)] space-y-2.5 hover:border-brand-200 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500">{s.step}</span>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-brand-950">{s.title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 text-center text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-brand-900">{BMU.name}, Surat</p>
        <p>AttendIQ — Smart Attendance & Student Engagement System • Hackathon prototype</p>
      </footer>
    </div>
  );
}
