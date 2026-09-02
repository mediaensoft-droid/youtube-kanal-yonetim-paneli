"use client";

import { useMemo, useState } from "react";
import { Search, Video } from "lucide-react";
import type { Category, Channel, Concept } from "@/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getLanguageName } from "@/lib/constants/languages";
import { formatCompactNumber } from "@/lib/format";

interface VideoCountsPanelProps {
  channels: Channel[];
  categories: Category[];
  concepts: Concept[];
}

export function VideoCountsPanel({ channels, categories, concepts }: VideoCountsPanelProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conceptFilter, setConceptFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);

  const availableLanguages = useMemo(() => {
    const codes = new Set<string>();
    channels.forEach((c) => c.languages.forEach((l) => codes.add(l)));
    return [...codes].sort();
  }, [channels]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels
      .filter((c) => {
        if (q && !c.name.toLowerCase().includes(q)) return false;
        if (categoryFilter && String(c.categoryId ?? "") !== categoryFilter) return false;
        if (conceptFilter && String(c.conceptId ?? "") !== conceptFilter) return false;
        if (languageFilter && !c.languages.includes(languageFilter)) return false;
        return true;
      })
      .sort((a, b) => (b.videoCount ?? 0) - (a.videoCount ?? 0) || a.name.localeCompare(b.name));
  }, [channels, search, categoryFilter, conceptFilter, languageFilter]);

  const totalCount = useMemo(
    () => rows.reduce((sum, c) => sum + (c.videoCount ?? 0), 0),
    [rows]
  );

  return (
    <div className="animate-scale-in mb-6 origin-top rounded-lg border border-line bg-surface p-4">
      <p className="mb-3 text-sm text-ink-muted">
        Her kanalın YouTube&apos;daki toplam video sayısını gösterir (kanal yenilendiğinde
        güncellenir).
      </p>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <p className="mb-3 text-sm text-ink-faint">
        {rows.length} kanal · toplam {formatCompactNumber(totalCount)} video
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-ink-faint">Henüz kanal eklenmedi.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-faint">Filtrelerle eşleşen kanal bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-medium text-ink-muted">
                <th className="px-4 py-2.5">Kanal</th>
                <th className="px-4 py-2.5">Kategori</th>
                <th className="px-4 py-2.5">Konsept</th>
                <th className="px-4 py-2.5 text-right">Video Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((channel) => {
                const category = channel.categoryId ? categoryById.get(channel.categoryId) : undefined;
                const concept = channel.conceptId ? conceptById.get(channel.conceptId) : undefined;
                return (
                  <tr key={channel.id} className="border-b border-line bg-surface-2/40 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="YouTube'da aç"
                          className="shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.name}
                            className="h-8 w-8 rounded-full object-cover transition-opacity duration-150 hover:opacity-80"
                          />
                        </a>
                        <span className="min-w-0 truncate font-medium text-ink" title={channel.name}>
                          {channel.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {category ? (
                        <CategoryBadge name={category.name} color={category.color} />
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {concept ? (
                        <CategoryBadge name={concept.name} color={concept.color} />
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        <Video className="h-3.5 w-3.5 text-ink-faint" />
                        {formatCompactNumber(channel.videoCount)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
