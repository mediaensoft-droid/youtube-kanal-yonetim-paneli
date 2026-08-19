import { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:border-line-strong hover:shadow-lg hover:shadow-black/20">
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-105">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="text-2xl font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
