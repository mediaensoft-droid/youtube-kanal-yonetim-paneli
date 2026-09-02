"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryDistributionEntry } from "@/lib/stats";
import { ChartTooltip } from "./ChartTooltip";

interface CategoryDistributionChartProps {
  data: CategoryDistributionEntry[];
}

const RADIAN = Math.PI / 180;

interface PercentLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

// Placed halfway through the donut's ring (rather than outside with leader lines) so the
// percentage sits on top of its own slice's color — compact, and unambiguous which slice it
// belongs to even once several slices are close in size.
function renderPercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: PercentLabelProps) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={12}
      fontWeight={700}
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    // A horizontal, bottom-aligned legend (rather than the old vertical one docked to the
    // right) so the donut never has to compete with legend text for horizontal space — that
    // side-by-side layout was cramped enough on a phone-width card to visually overlap.
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="44%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={data.length > 1 ? 2 : 0}
          isAnimationActive={false}
          label={renderPercentLabel}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="#181818" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          layout="horizontal"
          align="center"
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: 16 }}
          formatter={(value) => <span className="text-sm text-ink-muted">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-ink-faint">
      Henüz veri yok
    </div>
  );
}
