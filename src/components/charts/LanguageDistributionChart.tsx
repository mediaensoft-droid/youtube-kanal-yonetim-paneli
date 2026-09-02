"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CodeDistributionEntry } from "@/lib/stats";
import { ChartTooltip } from "./ChartTooltip";
import { languageFlagEmoji } from "@/lib/constants/languageFlags";

interface LanguageDistributionChartProps {
  data: CodeDistributionEntry[];
}

const BAR_COLOR = "#4DA3FF";

interface LanguageTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  data: CodeDistributionEntry[];
}

// A custom YAxis tick so each language label carries a small flag for its representative
// country — recharts only gives ticks the bar's "name" (the language), so we look the
// matching entry back up by name to get its code and resolve a flag for it.
function LanguageTick({ x = 0, y = 0, payload, data }: LanguageTickProps) {
  const entry = data.find((d) => d.name === payload?.value);
  const flag = entry ? languageFlagEmoji(entry.code) : "";
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="middle">
      {flag && <tspan fontSize={10}>{flag} </tspan>}
      <tspan fontSize={12} fill="#f1f1f1">
        {payload?.value}
      </tspan>
    </text>
  );
}

export function LanguageDistributionChart({ data }: LanguageDistributionChartProps) {
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
          width={110}
          tick={<LanguageTick data={data} />}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
