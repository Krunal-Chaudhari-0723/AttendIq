"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecommendationCard, RecommendationData, RecommendationItem } from "@/components/recommendations/RecommendationCard";
import { apiFetch } from "@/lib/api";
import { Lightbulb, RefreshCw, AlertTriangle, Sparkles, Info } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

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
        <div className="space-y-5 sm:space-y-6 max-w-4xl">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <Card className="border-l-[3px] border-l-accent-500">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-accent-700 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-accent-600" /> Academic insights
                  </p>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-brand-600" /> Recommended actions
                  </CardTitle>
                </div>
                <Button size="sm" variant="outline" className="text-xs gap-1.5 self-start sm:self-auto shrink-0" disabled={refreshing || !data} onClick={refresh}>
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Updating…" : "Update recommendations"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notice && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 animate-fadeIn">{notice}</p>}
              {!data && !error ? (
                <p className="text-xs text-slate-500 flex items-center justify-center gap-2 py-10">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-600" /> Loading…
                </p>
              ) : data?.recommendation ? (
                <RecommendationCard rec={data.recommendation} showAudience={false} onComplete={complete} />
              ) : data ? (
                <EmptyState
                  icon={Lightbulb}
                  title="No recommendations yet"
                  description="Click “Update recommendations” to get suggestions based on your recent records."
                />
              ) : null}
              <div className="flex gap-2 mt-5 p-3 rounded-lg bg-brand-50/60 border border-brand-100 text-[11px] text-brand-900 leading-relaxed">
                <Info className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-px" />
                <p>
                  Completing an action adds 30 minutes to your Learning Activity. Recommendations use only your recorded academic data.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
