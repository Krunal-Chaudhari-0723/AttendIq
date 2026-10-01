"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/** Trend vs one week earlier, always shown with an icon and a word (never colour alone). */
export const TrendBadge = ({ trend, delta }: { trend: string; delta?: number | null }) => {
  if (trend === "UP")
    return (
      <Badge variant="success" size="sm" className="gap-1">
        <TrendingUp className="w-3 h-3" /> Improving{delta ? ` (+${delta})` : ""}
      </Badge>
    );
  if (trend === "DOWN")
    return (
      <Badge variant="danger" size="sm" className="gap-1">
        <TrendingDown className="w-3 h-3" /> Declining{delta ? ` (${delta})` : ""}
      </Badge>
    );
  if (trend === "STABLE")
    return (
      <Badge variant="neutral" size="sm" className="gap-1">
        <Minus className="w-3 h-3" /> Stable
      </Badge>
    );
  return <Badge variant="neutral" size="sm">New</Badge>;
};

