"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface TrendLineProps {
  data: { label: string; value: number | null }[];
  valueName?: string;
  height?: number;
  domain?: [number, number];
  suffix?: string;
}

/** Single-series trend line (title names the series, so no legend). Null values render as gaps. */
export function TrendLine({ data, valueName = "Score", height = 200, domain = [0, 100], suffix = "" }: TrendLineProps) {
  if (!data.some((d) => d.value !== null)) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400" style={{ height }}>
        Not enough data to plot a trend yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis domain={domain} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          formatter={(v) => [v === null || v === undefined ? "No data" : `${v}${suffix}`, valueName]}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ r: 4, fill: "#4f46e5", stroke: "#ffffff", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
