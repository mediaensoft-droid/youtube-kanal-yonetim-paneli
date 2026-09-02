"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopology from "world-atlas/countries-50m.json";
import type { CodeDistributionEntry } from "@/lib/stats";
import { COUNTRY_MAP_IDS } from "@/lib/constants/countryMapIds";
import { countryFlagEmoji } from "@/lib/constants/countries";

interface CountryMapChartProps {
  data: CodeDistributionEntry[];
}

const WIDTH = 800;
const HEIGHT = 420;
const EMPTY_FILL = "#262626";
const STROKE = "#181818";
const HIGH = [45, 212, 191] as const; // #2DD4BF — matches the bar chart's country color
const LOW = [17, 74, 69] as const;

function highlightFill(count: number, max: number): string {
  const t = max > 0 ? Math.max(0.4, count / max) : 0.4;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(LOW[0], HIGH[0])}, ${mix(LOW[1], HIGH[1])}, ${mix(LOW[2], HIGH[2])})`;
}

export function CountryMapChart({ data }: CountryMapChartProps) {
  const [hover, setHover] = useState<{ name: string; count: number; x: number; y: number } | null>(
    null
  );

  const countByNumericId = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const entry of data) {
      const numericId = COUNTRY_MAP_IDS[entry.code];
      if (numericId) map.set(numericId, { code: entry.code, name: entry.name, count: entry.value });
    }
    return map;
  }, [data]);

  const maxCount = useMemo(() => data.reduce((m, d) => Math.max(m, d.value), 0), [data]);

  const paths = useMemo(() => {
    const topology = worldTopology as unknown as Topology;
    const geometries = topology.objects.countries as GeometryCollection;
    const geo = feature(topology, geometries);
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], geo);
    const path = geoPath(projection);
    return geo.features.map((f) => ({
      id: String(f.id),
      d: path(f) ?? "",
    }));
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-ink-faint">
        Henüz veri yok
      </div>
    );
  }

  const top = [...data].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label="Ülkeye göre kanal dağılımı haritası"
        >
          {paths.map((p) => {
            const match = countByNumericId.get(p.id);
            const fill = match ? highlightFill(match.count, maxCount) : EMPTY_FILL;
            return (
              <path
                key={p.id}
                d={p.d}
                fill={fill}
                stroke={STROKE}
                strokeWidth={0.5}
                className="transition-[fill] duration-150"
                style={match ? { cursor: "pointer" } : undefined}
                onMouseEnter={(e) => {
                  if (!match) return;
                  const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({
                    name: match.name,
                    count: match.count,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseMove={(e) => {
                  if (!match) return;
                  const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({
                    name: match.name,
                    count: match.count,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              >
                {match && <title>{`${match.name}: ${match.count} kanal`}</title>}
              </path>
            );
          })}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm shadow-xl shadow-black/40"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            <span className="font-medium text-ink">{hover.name}</span>
            <p className="mt-0.5 text-ink-muted">{hover.count} kanal</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-muted">
        {top.map((entry) => (
          <span key={entry.code} className="flex items-center gap-1.5">
            {entry.code !== "OTHER" && <span>{countryFlagEmoji(entry.code)}</span>}
            <span>{entry.name}</span>
            <span className="font-medium text-ink">{entry.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
