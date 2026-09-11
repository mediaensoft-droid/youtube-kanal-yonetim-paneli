"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, LayoutGrid, Grid3x3, List } from "lucide-react";
import clsx from "clsx";
import type { Category, Concept, Channel, ChannelStatus } from "@/types";
import { ChannelCard } from "@/components/ChannelCard";
import { ChannelListRow } from "@/components/ChannelListRow";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";

interface ChannelListClientProps {
  initialChannels: Channel[];
  categories: Category[];
  concepts: Concept[];
  /** Which status this tab lists; each status has its own tab in the hub. */
  status: ChannelStatus;
}

type ViewMode = "large" | "small" | "list";

const VIEW_MODE_STORAGE_KEY = "channelViewMode";

// Filters survive a round-trip to edit/detail pages (and the back button) within the tab, but reset
// when the tab is closed — sessionStorage, not localStorage, so a stale filter never greets a fresh visit.
const FILTER_STORAGE_PREFIX = "channelListFilters:";

interface StoredFilters {
  search: string;
  categoryFilter: string;
  conceptFilter: string;
  languageFilter: string;
  countryFilter: string;
}

const EMPTY_FILTERS: StoredFilters = {
  search: "",
  categoryFilter: "",
  conceptFilter: "",
  languageFilter: "",
  countryFilter: "",
};

function readStoredFilters(key: string): StoredFilters | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      categoryFilter: typeof parsed.categoryFilter === "string" ? parsed.categoryFilter : "",
      conceptFilter: typeof parsed.conceptFilter === "string" ? parsed.conceptFilter : "",
      languageFilter: typeof parsed.languageFilter === "string" ? parsed.languageFilter : "",
      countryFilter: typeof parsed.countryFilter === "string" ? parsed.countryFilter : "",
    };
  } catch {
    return null;
  }
}

const VIEW_MODES: { key: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { key: "large", label: "Büyük", icon: LayoutGrid },
  { key: "small", label: "Küçük", icon: Grid3x3 },
  { key: "list", label: "Liste", icon: List },
];

// Both need their own mobile (unprefixed) column count too — without it, "small" and "large"
// rendered identically (a single full-width column) below the sm breakpoint, since only the
// sm/lg/xl steps differed.
const GRID_CLASSES: Record<"large" | "small", string> = {
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  small: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
};

export function ChannelListClient({
  initialChannels,
  categories,
  concepts,
  status,
}: ChannelListClientProps) {
  const isPassiveScreen = status === "passive";
  const isPlannedScreen = status === "planned";
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [filters, setFilters] = useState<StoredFilters>(EMPTY_FILTERS);
  const { search, categoryFilter, conceptFilter, languageFilter, countryFilter } = filters;
  // Active and passive screens remember their filters independently.
  const filterStorageKey = FILTER_STORAGE_PREFIX + status;
  // The list is hidden until stored filters are restored, so a filtered view doesn't flash unfiltered.
  const [filtersRestored, setFiltersRestored] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("large");

  useEffect(() => {
    // Reads browser-only APIs (localStorage/sessionStorage), so it can't run during SSR/first
    // render — this one-time sync read on mount is the standard way to restore persisted state.
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "large" || stored === "small" || stored === "list") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode(stored);
    }
    const storedFilters = readStoredFilters(filterStorageKey);
    if (storedFilters) setFilters(storedFilters);
    setFiltersRestored(true);
  }, [filterStorageKey]);

  function updateFilter<K extends keyof StoredFilters>(key: K, value: StoredFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      try {
        sessionStorage.setItem(filterStorageKey, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode, quota) — filtering still works for this visit.
      }
      return next;
    });
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  // Ids of a category/concept deleted meanwhile simply resolve to nothing.
  const resolveCategories = (c: Channel) =>
    c.categoryIds.flatMap((id) => categoryById.get(id) ?? []);
  const resolveConcepts = (c: Channel) => c.conceptIds.flatMap((id) => conceptById.get(id) ?? []);

  const availableLanguages = useMemo(() => {
    const codes = new Set<string>();
    channels.forEach((c) => c.languages.forEach((l) => codes.add(l)));
    return [...codes].sort();
  }, [channels]);

  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    channels.forEach((c) => c.countries.forEach((cc) => codes.add(cc)));
    return [...codes].sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (categoryFilter && !c.categoryIds.includes(Number(categoryFilter))) return false;
      if (conceptFilter && !c.conceptIds.includes(Number(conceptFilter))) return false;
      if (languageFilter && !c.languages.includes(languageFilter)) return false;
      if (countryFilter && !c.countries.includes(countryFilter)) return false;
      return true;
    });
  }, [channels, search, categoryFilter, conceptFilter, languageFilter, countryFilter]);

  function handleRefreshed(updated: Channel) {
    setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(id: number) {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }

  // A channel that changed status now belongs to the other screen; drop it here.
  function handleStatusChanged(id: number) {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      {isPassiveScreen && (
        <p className="mb-4 text-sm text-ink-muted">
          Bu kanallar takvimde, Dashboard&apos;da ve diğer menülerde görünmez. Göz simgesiyle tekrar aktife
          alabilirsin.
        </p>
      )}
      {isPlannedScreen && (
        <p className="mb-4 text-sm text-ink-muted">
          Örnek/referans olarak takip ettiğin kanallar. İstatistikleri günlük güncellenir; takvimde,
          Dashboard&apos;da ve kendi kanal limitinde yer almazlar.
        </p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Kanal ara..."
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onChange={(e) => updateFilter("categoryFilter", e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={conceptFilter} onChange={(e) => updateFilter("conceptFilter", e.target.value)}>
          <option value="">Tüm konseptler</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={languageFilter} onChange={(e) => updateFilter("languageFilter", e.target.value)}>
          <option value="">Tüm diller</option>
          {availableLanguages.map((code) => (
            <option key={code} value={code}>
              {getLanguageName(code)}
            </option>
          ))}
        </Select>

        <Select value={countryFilter} onChange={(e) => updateFilter("countryFilter", e.target.value)}>
          <option value="">Tüm ülkeler</option>
          {availableCountries.map((code) => (
            <option key={code} value={code}>
              {countryFlagEmoji(code)} {getCountryName(code)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-ink-faint">{filteredChannels.length} kanal</p>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5">
          {VIEW_MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeViewMode(key)}
              title={label}
              className={clsx(
                "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                viewMode === key
                  ? "bg-brand text-white"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!filtersRestored ? null : filteredChannels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center text-ink-muted">
          {channels.length === 0
            ? isPassiveScreen
              ? "Pasif kanal yok."
              : isPlannedScreen
                ? "Henüz planlanan kanal eklenmedi."
                : "Henüz kanal eklenmedi."
            : "Filtrelerle eşleşen kanal bulunamadı."}
        </div>
      ) : viewMode === "list" ? (
        <div className="stagger flex flex-col gap-2">
          {filteredChannels.map((channel) => (
            <ChannelListRow
              key={channel.id}
              channel={channel}
              categories={resolveCategories(channel)}
              concepts={resolveConcepts(channel)}
              onRefreshed={handleRefreshed}
              onDeleted={handleDeleted}
              onStatusChanged={handleStatusChanged}
            />
          ))}
        </div>
      ) : (
        <div className={clsx("stagger grid gap-4", GRID_CLASSES[viewMode])}>
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              categories={resolveCategories(channel)}
              concepts={resolveConcepts(channel)}
              onRefreshed={handleRefreshed}
              onDeleted={handleDeleted}
              onStatusChanged={handleStatusChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
