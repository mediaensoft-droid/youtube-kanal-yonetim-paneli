"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, LayoutGrid, Grid3x3, List } from "lucide-react";
import clsx from "clsx";
import type { Category, Concept, Channel } from "@/types";
import { ChannelCard } from "@/components/ChannelCard";
import { ChannelListRow } from "@/components/ChannelListRow";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";

interface ChannelListClientProps {
  initialChannels: Channel[];
  categories: Category[];
  concepts: Concept[];
}

type ViewMode = "large" | "small" | "list";

const VIEW_MODE_STORAGE_KEY = "channelViewMode";

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

export function ChannelListClient({ initialChannels, categories, concepts }: ChannelListClientProps) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conceptFilter, setConceptFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("large");

  useEffect(() => {
    // Reads a browser-only API (localStorage), so it can't run during SSR/first render —
    // this one-time sync read on mount is the standard way to restore a persisted preference.
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "large" || stored === "small" || stored === "list") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode(stored);
    }
  }, []);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);

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
      if (categoryFilter && String(c.categoryId ?? "") !== categoryFilter) return false;
      if (conceptFilter && String(c.conceptId ?? "") !== conceptFilter) return false;
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

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">Kanallar</h1>
        <Link href="/channels/new">
          <Button>
            <Plus className="h-4 w-4" /> Kanal Ekle
          </Button>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kanal ara..."
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={conceptFilter} onChange={(e) => setConceptFilter(e.target.value)}>
          <option value="">Tüm konseptler</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
          <option value="">Tüm diller</option>
          {availableLanguages.map((code) => (
            <option key={code} value={code}>
              {getLanguageName(code)}
            </option>
          ))}
        </Select>

        <Select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
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

      {filteredChannels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong py-16 text-center text-ink-muted">
          {channels.length === 0
            ? "Henüz kanal eklenmedi."
            : "Filtrelerle eşleşen kanal bulunamadı."}
        </div>
      ) : viewMode === "list" ? (
        <div className="stagger flex flex-col gap-2">
          {filteredChannels.map((channel) => (
            <ChannelListRow
              key={channel.id}
              channel={channel}
              category={channel.categoryId ? categoryById.get(channel.categoryId) : undefined}
              concept={channel.conceptId ? conceptById.get(channel.conceptId) : undefined}
              onRefreshed={handleRefreshed}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      ) : (
        <div className={clsx("stagger grid gap-4", GRID_CLASSES[viewMode])}>
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              category={channel.categoryId ? categoryById.get(channel.categoryId) : undefined}
              concept={channel.conceptId ? conceptById.get(channel.conceptId) : undefined}
              onRefreshed={handleRefreshed}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
