import type { Category, Channel } from "@/types";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName } from "@/lib/constants/countries";
import { paletteColor } from "@/lib/colors";

export interface CategoryDistributionEntry {
  name: string;
  value: number;
  color: string;
}

export interface CodeDistributionEntry {
  code: string;
  name: string;
  value: number;
}

const OTHER_LABEL = "Diğer";
const UNCATEGORIZED_LABEL = "Kategorisiz";
const UNCATEGORIZED_COLOR = "#CBD5E1";

export function countByCategory(
  channels: Channel[],
  categories: Category[]
): CategoryDistributionEntry[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const counts = new Map<number | null, number>();

  for (const channel of channels) {
    const key = channel.categoryId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const entries: CategoryDistributionEntry[] = [];
  for (const [key, value] of counts) {
    if (key === null) {
      entries.push({ name: UNCATEGORIZED_LABEL, value, color: UNCATEGORIZED_COLOR });
    } else {
      const category = categoryById.get(key);
      entries.push({
        name: category?.name ?? UNCATEGORIZED_LABEL,
        value,
        color: category?.color ?? paletteColor(entries.length),
      });
    }
  }

  return entries.sort((a, b) => b.value - a.value);
}

function countByCode(
  channels: Channel[],
  getCodes: (channel: Channel) => string[],
  resolveName: (code: string) => string,
  topN = 8
): CodeDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const channel of channels) {
    for (const code of getCodes(channel)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .map(([code, value]) => ({ code, name: resolveName(code), value }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= topN) return sorted;

  const top = sorted.slice(0, topN);
  const otherValue = sorted.slice(topN).reduce((sum, e) => sum + e.value, 0);
  return [...top, { code: "OTHER", name: OTHER_LABEL, value: otherValue }];
}

export function countByLanguage(channels: Channel[]): CodeDistributionEntry[] {
  return countByCode(channels, (c) => c.languages, getLanguageName);
}

export function countByCountry(channels: Channel[]): CodeDistributionEntry[] {
  return countByCode(channels, (c) => c.countries, getCountryName);
}
