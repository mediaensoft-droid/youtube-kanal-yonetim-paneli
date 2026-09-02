"use client";

import { useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Position } from "geojson";
import worldTopology from "world-atlas/countries-50m.json";
import type { CodeDistributionEntry } from "@/lib/stats";
import { COUNTRY_MAP_IDS } from "@/lib/constants/countryMapIds";

interface CountryYandexMapProps {
  data: CodeDistributionEntry[];
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

export function CountryYandexMap({ data }: CountryYandexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymaps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(() => (YANDEX_API_KEY ? null : "no-key"));

  // Load the script and create the map instance once.
  useEffect(() => {
    if (!YANDEX_API_KEY) return;
    let cancelled = false;

    loadYandexMapsScript(YANDEX_API_KEY)
      .then(() => new Promise<void>((resolve) => window.ymaps!.ready(resolve)))
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new window.ymaps!.Map(
          containerRef.current,
          {
            center: [25, 15],
            zoom: 2,
            controls: ["zoomControl"],
          },
          { suppressMapOpenBlock: true }
        );
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("load-failed");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

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
            fillColor: highlightColor(match.count, maxCount),
            fillOpacity: 0.75,
            strokeColor: "#181818",
            strokeWidth: 1,
            strokeOpacity: 0.9,
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

  return <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-lg" />;
}
