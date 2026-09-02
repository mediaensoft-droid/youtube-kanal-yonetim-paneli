"use client";

import { useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Position } from "geojson";
import worldTopology from "world-atlas/countries-50m.json";
import { Map as MapIcon, Satellite, Sun, Moon } from "lucide-react";
import clsx from "clsx";
import type { CodeDistributionEntry } from "@/lib/stats";
import { COUNTRY_MAP_IDS } from "@/lib/constants/countryMapIds";

type YandexMapType = "yandex#map" | "yandex#satellite";

// A CSS-filter "dark mode" — Yandex's 2.1 JS API has no native dark tile theme (that's a v3-only
// feature), so this inverts the tile colors instead. Applied to the map's own wrapper div only,
// never to the control buttons, so the buttons stay legible in both modes.
const DARK_MODE_FILTER = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)";

interface CountryYandexMapProps {
  data: CodeDistributionEntry[];
  // Yandex's JS API doesn't reject/throw on an invalid or not-yet-fully-activated key — it just
  // logs "(Yandex Maps JS API): Invalid API key" to the console and renders a tile-less black
  // map. There's no documented catchable event for this in the 2.1 API, so we intercept
  // console.warn during load to detect it and let the caller fall back to a working map instead.
  onInvalidKey?: () => void;
}

const YANDEX_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
const HIGH = [45, 212, 191] as const; // #2DD4BF — matches the rest of this app's charts
const LOW = [17, 74, 69] as const;

function highlightColor(count: number, max: number): string {
  const t = max > 0 ? Math.max(0.4, count / max) : 0.4;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${[mix(LOW[0], HIGH[0]), mix(LOW[1], HIGH[1]), mix(LOW[2], HIGH[2])]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

// [lng, lat] (GeoJSON) -> [lat, lng] (Yandex Maps coordinate order)
function toYandexRing(ring: Position[]): number[][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

let scriptLoadPromise: Promise<void> | null = null;
function loadYandexMapsScript(apiKey: string): Promise<void> {
  if (typeof window !== "undefined" && window.ymaps) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=tr_TR`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Yandex Haritalar betiği yüklenemedi."));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function CountryYandexMap({ data, onInvalidKey }: CountryYandexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymaps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(() => (YANDEX_API_KEY ? null : "no-key"));
  const [mapType, setMapType] = useState<YandexMapType>("yandex#map");
  const [darkMode, setDarkMode] = useState(false);

  // Load the script and create the map instance once.
  useEffect(() => {
    if (!YANDEX_API_KEY) return;
    let cancelled = false;
    let invalidKey = false;

    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (/invalid api.?key/i.test(args.map(String).join(" "))) invalidKey = true;
      originalWarn.apply(console, args);
    };

    loadYandexMapsScript(YANDEX_API_KEY)
      .then(() => new Promise<void>((resolve) => window.ymaps!.ready(resolve)))
      .then(() => {
        console.warn = originalWarn;
        if (invalidKey) {
          if (!cancelled) onInvalidKey?.();
          return;
        }
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new window.ymaps!.Map(
          containerRef.current,
          {
            center: [25, 15],
            zoom: 2,
            controls: ["zoomControl"],
          },
          {
            suppressMapOpenBlock: true,
            // Without these, zooming/panning past the world's edge repeats the map
            // sideways and shows empty gray strips above/below — restrictMapArea
            // pins panning to the real world extent, minZoom stops "-" before the
            // whole world no longer fills the view. Explicit bounds (rather than the
            // boolean `true` shorthand, which asks Yandex to derive bounds from the
            // current map type) avoid an internal bounds-fitting bug that was forcing
            // the map to an unusable street-level zoom on load.
            restrictMapArea: [
              [-85, -180],
              [85, 180],
            ],
            minZoom: 2,
          }
        );
        // Yandex sizes the map from the container's dimensions at the instant of
        // construction. If layout hasn't fully settled yet (e.g. mid CSS transition),
        // it can misjudge the container as tiny and compute an absurd zoom to "fit" —
        // this forces a resync once the real size is known.
        mapRef.current.container.fitToViewport();
        setMapReady(true);
      })
      .catch(() => {
        console.warn = originalWarn;
        if (!cancelled) setError("load-failed");
      });

    return () => {
      cancelled = true;
      console.warn = originalWarn;
    };
    // Runs once on mount only — deliberately ignores onInvalidKey identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  // Re-sync the map if the container's size changes after creation (e.g. a layout
  // shift while the dashboard's entrance animations are still settling) — otherwise
  // the zoom Yandex computed at construction time can stay wrong indefinitely.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.container.fitToViewport();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function changeMapType(type: YandexMapType) {
    setMapType(type);
    mapRef.current?.setType(type).catch(() => {});
  }

  // (Re)draw the country overlays whenever the map becomes ready or the data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.ymaps) return;

    map.geoObjects.removeAll();

    const countByNumericId = new Map<string, { name: string; count: number }>();
    for (const entry of data) {
      const numericId = COUNTRY_MAP_IDS[entry.code];
      if (numericId) countByNumericId.set(numericId, { name: entry.name, count: entry.value });
    }
    const maxCount = data.reduce((m, d) => Math.max(m, d.value), 0);

    const topology = worldTopology as unknown as Topology;
    const geometries = topology.objects.countries as GeometryCollection;
    const geo = feature(topology, geometries);

    for (const f of geo.features) {
      const match = countByNumericId.get(String(f.id));
      if (!match) continue;

      const polygons =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates
            : [];

      for (const rings of polygons) {
        const geoObject = new window.ymaps.GeoObject(
          {
            geometry: {
              type: "Polygon",
              coordinates: rings.map(toYandexRing),
            },
            properties: {
              balloonContent: `${match.name}: ${match.count} kanal`,
              hintContent: match.name,
            },
          } as unknown as ymaps.IGeoObjectFeature,
          {
            // Outline-only: a near-transparent fill keeps the whole country clickable/
            // hoverable, but visually the real map tiles show through — only the border
            // (colored by channel count, like the old fill was) marks the country.
            fillColor: highlightColor(match.count, maxCount),
            fillOpacity: 0.05,
            strokeColor: highlightColor(match.count, maxCount),
            strokeWidth: 3,
            strokeOpacity: 1,
          }
        );
        map.geoObjects.add(geoObject);
      }
    }
  }, [data, mapReady]);

  if (data.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-ink-faint">
        Henüz veri yok
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[420px] items-center justify-center text-sm text-ink-faint">
        Harita yüklenemedi, lütfen sayfayı yenileyin.
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-lg"
        style={darkMode ? { filter: DARK_MODE_FILTER } : undefined}
      />

      <div className="absolute left-2 top-2 flex gap-1">
        <button
          type="button"
          onClick={() => changeMapType("yandex#map")}
          title="Harita görünümü"
          className={clsx(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
            mapType === "yandex#map"
              ? "border-brand bg-brand text-white"
              : "border-line-strong bg-surface-2 text-ink-muted hover:text-ink"
          )}
        >
          <MapIcon className="h-3.5 w-3.5" /> Harita
        </button>
        <button
          type="button"
          onClick={() => changeMapType("yandex#satellite")}
          title="Uydu görünümü"
          className={clsx(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
            mapType === "yandex#satellite"
              ? "border-brand bg-brand text-white"
              : "border-line-strong bg-surface-2 text-ink-muted hover:text-ink"
          )}
        >
          <Satellite className="h-3.5 w-3.5" /> Uydu
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDarkMode((d) => !d)}
        title={darkMode ? "Açık görünüm" : "Koyu görünüm"}
        className="absolute left-2 top-11 flex h-7 w-7 items-center justify-center rounded-md border border-line-strong bg-surface-2 text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
