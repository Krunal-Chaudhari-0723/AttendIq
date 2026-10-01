"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { MapPin, Save, ShieldCheck, Compass, AlertTriangle, Radio } from "lucide-react";

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
        <div className="space-y-6 max-w-4xl">
          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-fadeIn flex items-center justify-between">
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg(null)}>✕</button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-fadeIn flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)}>✕</button>
            </div>
          )}

          {!isLoading && !config.isConfigured && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Campus location is not configured yet. Physical attendance is blocked until you save the real campus
                coordinates below.
              </span>
            </div>
          )}

          {/* Architecture Card */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-start gap-3 shadow-md">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Campus location verification
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Face recognition verifies <em>identity</em>, but physical presence requires geolocation validation. During attendance, the browser Geolocation API requests coordinates and the backend validates that distance &le; authorized radius. Do not hard-code fixed coordinates; configure them here.
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Authorized Campus Perimeter</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Campus Facility Name</label>
                  <Input
                    required
                    value={config.campusName}
                    onChange={(e) => setConfig({ ...config, campusName: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Authorized Latitude</label>
                    <Input
                      type="number"
                      step="0.000001"
                      required
                      value={config.latitude}
                      onChange={(e) => setConfig({ ...config, latitude: Number(e.target.value) })}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Authorized Longitude</label>
                    <Input
                      type="number"
                      step="0.000001"
                      required
                      value={config.longitude}
                      onChange={(e) => setConfig({ ...config, longitude: Number(e.target.value) })}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    className="text-xs gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5 text-indigo-600" /> Use Current Browser Coordinates
                  </Button>
                  <span className="text-[11px] text-slate-400">Haversine formula validation applied on backend</span>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Allowed Perimeter Radius (Meters)</label>
                    <Badge variant="purple" size="sm">
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
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Students outside this radius will be rejected during Physical Attendance verification.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Maximum Location Inaccuracy (Meters)</label>
                    <Badge variant="neutral" size="sm">
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
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Browsers report how precise each location fix is. Fixes less precise than this are rejected so a
                    coarse network-based location cannot be used to pass the radius check.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Verification Policies */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  <span>Enforcement & Permitted Modes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enforce Strict Geofence Radius</p>
                    <p className="text-[11px] text-slate-500">
                      When enabled, physical attendance requests will be strictly rejected if distance &gt; radius.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.isEnforced}
                    onChange={(e) => setConfig({ ...config, isEnforced: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Supported Attendance Modes</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.allowedModes.includes("PHYSICAL")}
                        onChange={(e) => {
                          const modes = e.target.checked
                            ? [...config.allowedModes, "PHYSICAL"]
                            : config.allowedModes.filter((m) => m !== "PHYSICAL");
                          setConfig({ ...config, allowedModes: modes });
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Physical Mode</span>
                        <p className="text-[10px] text-slate-400">Location + Face + Liveness</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.allowedModes.includes("REMOTE")}
                        onChange={(e) => {
                          const modes = e.target.checked
                            ? [...config.allowedModes, "REMOTE"]
                            : config.allowedModes.filter((m) => m !== "REMOTE");
                          setConfig({ ...config, allowedModes: modes });
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Remote Mode</span>
                        <p className="text-[10px] text-slate-400">Face + Session Signals</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2 shadow-sm"
                  >
                    <Save className="w-4 h-4" /> {isSaving ? "Saving Configuration..." : "Save Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
