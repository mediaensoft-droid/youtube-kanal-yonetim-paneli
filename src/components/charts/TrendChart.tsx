"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompactNumber, formatShortDate } from "@/lib/format";

export interface TrendPoint {
  capturedAt: string;
  value: number | null;
}

interface TrendChartProps {
  data: TrendPoint[];
  color: string;
}

interface TooltipPayloadItem {
  value?: number;
  payload?: TrendPoint;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point) return null;

  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm shadow-xl shadow-black/40">
      <p className="text-ink-muted">{formatShortDate(point.capturedAt)}</p>
      <p className="font-medium text-ink">{formatCompactNumber(point.value)}</p>
    </div>
  );
}

export function TrendChart({ data, color }: TrendChartProps) {
  const points = data.filter((d) => d.value !== null);

  if (points.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center text-center text-sm text-ink-faint">
        Trend verisi birikiyor — birkaç gün sonra burada görünecek.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#303030" vertical={false} />
        <XAxis
          dataKey="capturedAt"
          tickFormatter={(v: string) => formatShortDate(v)}
          tick={{ fontSize: 11, fill: "#aaaaaa" }}
          minTickGap={30}
        />
        <YAxis
          width={44}
          tickFormatter={(v: number) => formatCompactNumber(v)}
          tick={{ fontSize: 11, fill: "#aaaaaa" }}
        />
        <Tooltip content={<TrendTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
