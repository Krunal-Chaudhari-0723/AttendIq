"use client";

import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";

interface LabeledBarsProps {
  data: { label: string; value: number | null; color?: string }[];
  height?: number;
  max?: number;
  suffix?: string;
  valueName?: string;
}

/** Horizontal bars with direct value labels (identity is never colour-alone). */
export function LabeledBars({ data, height, max = 100, suffix = "", valueName = "Value" }: LabeledBarsProps) {
  const rows = data.map((d) => ({ ...d, plotted: d.value ?? 0, text: d.value === null ? "No data" : `${d.value}${suffix}` }));
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={8}>
        <XAxis type="number" domain={[0, max]} hide />
        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          formatter={(_v, _n, item) => [(item?.payload as { text: string }).text, valueName]}
        />
        <Bar dataKey="plotted" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.label} fill={r.value === null ? "#e2e8f0" : r.color ?? "#4f46e5"} />
          ))}
          <LabelList dataKey="text" position="right" style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
