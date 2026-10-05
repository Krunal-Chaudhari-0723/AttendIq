"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { BMU, BMUCrest } from "@/components/brand/BMUBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { MapPin, Save, ShieldCheck, Compass, AlertTriangle, Radio, Info, CheckCircle2 } from "lucide-react";

interface CampusConfig {
  campusName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  isConfigured?: boolean;
  isEnforced: boolean;
  allowedModes: string[];
}

export default function AdminCampusSettingsPage() {
  const [config, setConfig] = useState<CampusConfig>({
    campusName: "AttendIQ Central Campus",
    latitude: 23.0225,
    longitude: 72.5714,
    radiusMeters: 250,
    maxAccuracyMeters: 500,
    isConfigured: false,
    isEnforced: true,
    allowedModes: ["PHYSICAL", "REMOTE"],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch<CampusConfig>("/admin/campus-settings");
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      console.error("Failed to load campus settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const res = await apiFetch("/admin/campus-settings", {
      method: "PUT",
      body: JSON.stringify(config),
    });

    setIsSaving(false);

    if (res.success) {
      setSuccessMsg("Campus perimeter and attendance verification parameters saved!");
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchSettings();
    } else {
      setErrorMsg(res.error || "Failed to update campus settings");
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("This browser does not support location services.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setConfig((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setSuccessMsg(
          `Captured current coordinates (accuracy ±${Math.round(pos.coords.accuracy)} m). Review them and click Save Settings.`
        );
        setTimeout(() => setSuccessMsg(null), 6000);
      },
      (err) => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access for this site or enter coordinates manually."
            : `Could not read location: ${err.message}`
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AppShell
        title="Campus & Attendance Settings"
        subtitle="Configure physical geofence coordinates, allowed verification radius, and attendance modes"
        defaultRole="ADMIN"
      >
        <div className="space-y-6">
          {/* Institutional context */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 sm:px-5 py-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 min-w-0">
              <BMUCrest height={36} />
              <div className="min-w-0">
                <p className="eyebrow text-brand-600">Campus &amp; Attendance Settings</p>
                <p className="text-sm font-semibold text-brand-950">{BMU.name}</p>
                <p className="text-[11px] text-slate-500">{BMU.location}</p>
              </div>
            </div>
            {!isLoading && (
              <Badge variant={config.isConfigured ? "success" : "warning"} size="sm" className="self-start sm:self-center gap-1">
                <MapPin className="w-3 h-3" />
                {config.isConfigured ? "Perimeter configured" : "Perimeter not configured"}
              </Badge>
            )}
          </div>

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fadeIn flex items-center justify-between gap-3">
              <span className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {successMsg}
              </span>
              <button onClick={() => setSuccessMsg(null)} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-100 shrink-0">✕</button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-fadeIn flex items-center justify-between gap-3">
              <span className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {errorMsg}
              </span>
              <button onClick={() => setErrorMsg(null)} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-rose-700 hover:bg-rose-100 shrink-0">✕</button>
            </div>
          )}

          {!isLoading && !config.isConfigured && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Campus location is not configured yet. Physical attendance is blocked until you save the real campus
                coordinates below.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
            <form onSubmit={handleSave} className="space-y-5 lg:col-span-2 min-w-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-600" />
                    <span>Authorized Campus Perimeter</span>
                  </CardTitle>
                  <CardDescription>The university location against which physical attendance is verified.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Campus Facility Name</label>
                    <Input
                      required
                      value={config.campusName}
                      onChange={(e) => setConfig({ ...config, campusName: e.target.value })}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <p className="eyebrow text-brand-600">Coordinates</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Authorized Latitude</label>
                        <Input
                          type="number"
                          step="0.000001"
                          required
                          value={config.latitude}
                          onChange={(e) => setConfig({ ...config, latitude: Number(e.target.value) })}
                          className="text-sm font-mono tabular-nums"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Authorized Longitude</label>
                        <Input
                          type="number"
                          step="0.000001"
                          required
                          value={config.longitude}
                          onChange={(e) => setConfig({ ...config, longitude: Number(e.target.value) })}
                          className="text-sm font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGetCurrentLocation}
                        className="text-xs gap-1.5 self-start"
                      >
                        <Compass className="w-3.5 h-3.5 text-brand-600" /> Use Current Browser Coordinates
                      </Button>
                      <span className="text-[11px] text-slate-500">Haversine formula validation applied on backend</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-700">Allowed Perimeter Radius (Meters)</label>
                        <Badge variant="brand" size="sm" className="tabular-nums">
                          {config.radiusMeters} Meters
                        </Badge>
                      </div>
                      <Input
                        type="number"
                        min="10"
                        max="5000"
                        required
                        value={config.radiusMeters}
                        onChange={(e) => setConfig({ ...config, radiusMeters: Number(e.target.value) })}
                        className="text-sm font-mono tabular-nums"
                      />
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Students outside this radius will be rejected during Physical Attendance verification.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-700">Maximum Location Inaccuracy (Meters)</label>
                        <Badge variant="neutral" size="sm" className="tabular-nums">
                          ±{config.maxAccuracyMeters} m
                        </Badge>
                      </div>
                      <Input
                        type="number"
                        min="10"
                        max="5000"
                        required
                        value={config.maxAccuracyMeters}
                        onChange={(e) => setConfig({ ...config, maxAccuracyMeters: Number(e.target.value) })}
                        className="text-sm font-mono tabular-nums"
                      />
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Browsers report how precise each location fix is. Fixes less precise than this are rejected so a
                        coarse network-based location cannot be used to pass the radius check.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Policies */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-brand-600" />
                    <span>Enforcement & Permitted Modes</span>
                  </CardTitle>
                  <CardDescription>Policy applied when students mark attendance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <p className="eyebrow text-brand-600">Strict geofence</p>
                    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/60">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-950">Enforce Strict Geofence Radius</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                          When enabled, physical attendance requests will be strictly rejected if distance &gt; radius.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.isEnforced}
                        onChange={(e) => setConfig({ ...config, isEnforced: e.target.checked })}
                        className="w-5 h-5 mt-0.5 text-brand-600 rounded accent-brand-700 shrink-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-5">
                    <p className="text-xs font-semibold text-slate-700">Supported Attendance Modes</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={config.allowedModes.includes("PHYSICAL")}
                          onChange={(e) => {
                            const modes = e.target.checked
                              ? [...config.allowedModes, "PHYSICAL"]
                              : config.allowedModes.filter((m) => m !== "PHYSICAL");
                            setConfig({ ...config, allowedModes: modes });
                          }}
                          className="w-4 h-4 mt-0.5 text-brand-600 rounded accent-brand-700 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-semibold text-brand-950">Physical Mode</span>
                          <p className="text-[11px] text-slate-500">Location + Face + Liveness</p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={config.allowedModes.includes("REMOTE")}
                          onChange={(e) => {
                            const modes = e.target.checked
                              ? [...config.allowedModes, "REMOTE"]
                              : config.allowedModes.filter((m) => m !== "REMOTE");
                            setConfig({ ...config, allowedModes: modes });
                          }}
                          className="w-4 h-4 mt-0.5 text-brand-600 rounded accent-brand-700 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-semibold text-brand-950">Remote Mode</span>
                          <p className="text-[11px] text-slate-500">Face + Session Signals</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="text-xs gap-2 w-full sm:w-auto"
                  >
                    <Save className="w-4 h-4" /> {isSaving ? "Saving Configuration..." : "Save Settings"}
                  </Button>
                </CardFooter>
              </Card>
            </form>

            <aside className="space-y-4 min-w-0">
              <div className="flex gap-3 p-4 rounded-lg bg-brand-50/60 border border-brand-100 text-xs text-brand-900">
                <Info className="w-4 h-4 text-brand-600 shrink-0 mt-px" />
                <p className="leading-relaxed">
                  Campus location verification helps confirm that physical attendance is recorded within the authorized university perimeter.
                </p>
              </div>

              {/* Architecture Card */}
              <Card>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <h4 className="eyebrow text-brand-700">
                      Campus location verification
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Face recognition verifies <em>identity</em>, but physical presence requires geolocation validation. During attendance, the browser Geolocation API requests coordinates and the backend validates that distance &le; authorized radius. Do not hard-code fixed coordinates; configure them here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
