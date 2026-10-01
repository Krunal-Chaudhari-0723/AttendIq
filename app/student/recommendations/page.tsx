"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecommendationCard, RecommendationData, RecommendationItem } from "@/components/recommendations/RecommendationCard";
import { apiFetch } from "@/lib/api";
import { Lightbulb, RefreshCw, AlertTriangle } from "lucide-react";

interface MyRecommendations {
  recommendation: RecommendationData | null;
  aiConfigured: boolean;
}

export default function StudentRecommendationsPage() {
  const [data, setData] = useState<MyRecommendations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MyRecommendations>("/student/recommendations").then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error || "Could not load recommendations.");
    });
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    setNotice(null);
    const res = await apiFetch<{ recommendation: RecommendationData }>("/student/recommendations/generate", { method: "POST" });
    setRefreshing(false);
    if (res.success && res.data) setData((d) => ({ aiConfigured: d?.aiConfigured ?? false, recommendation: res.data!.recommendation }));
    else setNotice(res.error || "Could not refresh recommendations.");
  };

  const complete = async (item: RecommendationItem) => {
    if (!data?.recommendation) return;
    const res = await apiFetch<RecommendationData>(`/student/recommendations/${data.recommendation.id}/items/${item.index}/complete`, { method: "POST" });
    if (res.success && res.data) setData({ ...data, recommendation: res.data });
    else setNotice(res.error || "Could not update this action.");
  };

  return (
    <ProtectedRoute allowedRoles={["STUDENT"]}>
      <AppShell title="My Recommendations" subtitle="Personal next steps based on your attendance, quizzes, assignments and engagement" defaultRole="STUDENT">
        <div className="space-y-6 max-w-4xl">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600" /> Recommended actions
                </CardTitle>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" disabled={refreshing || !data} onClick={refresh}>
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Updating…" : "Update recommendations"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notice && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">{notice}</p>}
              {!data && !error ? (
                <p className="text-xs text-slate-500 flex items-center gap-2 py-6">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading…
                </p>
              ) : data?.recommendation ? (
                <RecommendationCard rec={data.recommendation} showAudience={false} onComplete={complete} />
              ) : data ? (
                <div className="text-center py-10 space-y-2">
                  <Lightbulb className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">No recommendations yet</p>
                  <p className="text-xs text-slate-500">Click “Update recommendations” to get suggestions based on your recent records.</p>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-400 mt-4">
                Completing an action adds 30 minutes to your Learning Activity. Recommendations use only your recorded academic data.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
