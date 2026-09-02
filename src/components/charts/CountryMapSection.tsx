"use client";

import { useState } from "react";
import type { CodeDistributionEntry } from "@/lib/stats";
import { CountryMapChart } from "./CountryMapChart";
import { CountryYandexMap } from "./CountryYandexMap";

interface CountryMapSectionProps {
  data: CodeDistributionEntry[];
}

const HAS_YANDEX_KEY = Boolean(process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY);

export function CountryMapSection({ data }: CountryMapSectionProps) {
  // Having a key configured doesn't guarantee Yandex will actually accept it (e.g. the
  // account's billing/verification step isn't finished yet) — CountryYandexMap detects that
  // at runtime and calls this to drop back to the always-working SVG map instead of showing
  // a broken black tile-less map.
  const [yandexFailed, setYandexFailed] = useState(false);

  if (HAS_YANDEX_KEY && !yandexFailed) {
    return <CountryYandexMap data={data} onInvalidKey={() => setYandexFailed(true)} />;
  }
  return <CountryMapChart data={data} />;
}
