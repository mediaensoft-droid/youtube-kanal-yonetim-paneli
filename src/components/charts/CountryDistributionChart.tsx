"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CodeDistributionEntry } from "@/lib/stats";
import { ChartTooltip } from "./ChartTooltip";

interface CountryDistributionChartProps {
  data: CodeDistributionEntry[];
}

const BAR_COLOR = "#2DD4BF";

export function CountryDistributionChart({ data }: CountryDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-ink-faint">
        Henüz veri yok
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#303030" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#aaaaaa" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12, fill: "#f1f1f1" }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
