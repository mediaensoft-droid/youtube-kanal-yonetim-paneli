"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Pencil, Trash2, BarChart3, ChevronRight, Users, Video } from "lucide-react";
import { toast } from "sonner";
import type { Channel, Category, Concept } from "@/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";
import { formatCompactNumber } from "@/lib/format";

interface ChannelCardProps {
  channel: Channel;
  category: Category | undefined;
  concept: Concept | undefined;
  onRefreshed: (channel: Channel) => void;
  onDeleted: (id: number) => void;
}

export function ChannelCard({ channel, category, concept, onRefreshed, onDeleted }: ChannelCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    setRefreshing(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yenileme başarısız oldu");
      onRefreshed(data);
      toast.success(`${data.name} güncellendi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yenileme başarısız oldu");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Silme başarısız oldu");
      }
      onDeleted(channel.id);
      toast.success("Kanal silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme başarısız oldu");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div
        onClick={() => window.open(channel.url, "_blank", "noopener,noreferrer")}
        className="group cursor-pointer overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-xl hover:shadow-black/30"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
          {channel.thumbnailUrl ? (
            // YouTube channel avatars are square; object-contain avoids cropping (unlike video thumbnails, which are 16:9).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.thumbnailUrl}
              alt={channel.name}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-faint">
              Görsel yok
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>

        <div className="p-4">
          <h3 className="truncate text-base font-semibold text-ink" title={channel.name}>
            {channel.name}
          </h3>

          <div className="mt-1.5 flex items-center gap-4 text-sm text-ink-muted">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {formatCompactNumber(channel.subscriberCount)}
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-3.5 w-3.5" /> {formatCompactNumber(channel.videoCount)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {category ? (
              <CategoryBadge name={category.name} color={category.color} />
            ) : (
              <span className="text-xs text-ink-faint">Kategorisiz</span>
            )}
            {concept && <CategoryBadge name={concept.name} color={concept.color} />}
          </div>

          {(channel.languages.length > 0 || channel.countries.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {channel.languages.map((code) => (
                <span
                  key={`lang-${code}`}
                  className="rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-ink-muted"
                >
                  {getLanguageName(code)}
                </span>
              ))}
              {channel.countries.map((code) => (
                <span
                  key={`country-${code}`}
                  className="rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-ink-muted"
                >
                  {countryFlagEmoji(code)} {getCountryName(code)}
                </span>
              ))}
            </div>
          )}

          <Link
            href={`/channels/${channel.id}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-medium text-brand transition-colors duration-150 hover:border-brand/60 hover:bg-brand hover:text-white"
          >
            <BarChart3 className="h-4 w-4" /> Detayları Gör
            <ChevronRight className="h-4 w-4" />
          </Link>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-brand disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </button>
            <div className="flex items-center gap-1">
              <Link
                href={`/channels/${channel.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
                disabled={deleting}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 transition-colors duration-150 hover:bg-red-950/40 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Kanalı sil"
        description={`"${channel.name}" kalıcı olarak silinecek. Emin misiniz?`}
        confirmLabel="Sil"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
