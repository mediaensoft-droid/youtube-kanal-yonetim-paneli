interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string; color?: string };
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayloadItem[];
}

export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const name = item.payload?.name ?? item.name ?? label;
  const color = item.payload?.color ?? item.color ?? "#aaaaaa";

  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm shadow-xl shadow-black/40">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-medium text-ink">{name}</span>
      </div>
      <p className="mt-0.5 text-ink-muted">{item.value} kanal</p>
    </div>
  );
}
