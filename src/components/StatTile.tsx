"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { CardShapes } from "@/components/CardShapes";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

// Deterministic seed from the label so each tile's floating shapes look different from its
// siblings without needing an extra prop at every call site.
function seedFromLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 1000;
  return h;
}

// Counts up from 0 to the target on mount/change instead of just appearing — purely a "the
// dashboard feels alive" touch. Non-numeric values (e.g. "8 / 9") skip the animation and render
// as-is, since there's nothing sensible to count between.
function useCountUp(target: number | null, durationMs = 700): number {
  const [displayed, setDisplayed] = useState(target ?? 0);
  const previous = useRef(target ?? 0);

  useEffect(() => {
    if (target === null) return;
    const from = previous.current;
    const delta = target - from;
    if (delta === 0) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayed(Math.round(from + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else previous.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return displayed;
}

export function StatTile({ label, value, icon }: StatTileProps) {
  const numericValue = typeof value === "number" ? value : null;
  const animated = useCountUp(numericValue);

  return (
    <div className="group relative flex items-center gap-4 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20">
      <CardShapes seed={seedFromLabel(label)} count={3} />
      {icon && (
        <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-105">
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand-soft" aria-hidden="true" />
          <span className="relative">{icon}</span>
        </div>
      )}
      <div className="relative z-10">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="text-2xl font-semibold text-ink tabular-nums">
          {numericValue === null ? value : animated}
        </p>
      </div>
    </div>
  );
}
