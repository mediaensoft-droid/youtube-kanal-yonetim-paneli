"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryDistributionEntry } from "@/lib/stats";
import { ChartTooltip } from "./ChartTooltip";

interface CategoryDistributionChartProps {
  data: CategoryDistributionEntry[];
}

export function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={data.length > 1 ? 2 : 0}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="#181818" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
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
