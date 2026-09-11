"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Pencil,
  Trash2,
  BarChart3,
  ChevronRight,
  Settings2,
  ListVideo,
  Users,
  Video,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { Channel, Category, Concept, ChannelStatus } from "@/types";
import { ChannelTagBadges } from "@/components/ChannelTagBadges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ChannelDeleteWarning } from "@/components/ChannelDeleteWarning";
import { ChannelPassiveWarning } from "@/components/ChannelPassiveWarning";
import { ChannelActivateWarning } from "@/components/ChannelActivateWarning";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";
import { formatCompactNumber } from "@/lib/format";
import { studioCustomizeUrl, studioVideosUrl } from "@/lib/studioLinks";

interface ChannelCardProps {
  channel: Channel;
  categories: Category[];
  concepts: Concept[];
  onRefreshed: (channel: Channel) => void;
  onDeleted: (id: number) => void;
  /** Fired after the channel flips active⇄passive; the list drops it since it now belongs to the other screen. */
  onStatusChanged: (id: number) => void;
}

export function ChannelCard({ channel, categories, concepts, onRefreshed, onDeleted, onStatusChanged }: ChannelCardProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [passiveConfirmOpen, setPassiveConfirmOpen] = useState(false);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);

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

  const isActive = channel.status === "active";
  const isPlanned = channel.status === "planned";
  // Planned (reference) channels aren't the user's own, so parking them makes no sense — they get
  // a "make active" action instead, which moves them into the own-channel set.
  const canToggle = !isPlanned;

  async function changeStatus(nextStatus: ChannelStatus) {
    setToggling(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "İşlem başarısız oldu");
      onStatusChanged(channel.id);
      // Calendar/dashboard/category counts all derive from the active set — refresh their server data.
      router.refresh();
      toast.success(
        isPlanned
          ? "Kanal aktif kanallarına taşındı"
          : nextStatus === "active"
            ? "Kanal aktife alındı"
            : "Kanal pasife alındı"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız oldu");
    } finally {
      setToggling(false);
      setPassiveConfirmOpen(false);
      setActivateConfirmOpen(false);
    }
  }

  function handleToggleActive() {
    return changeStatus(isActive ? "passive" : "active");
  }

  // Reactivating is harmless (nothing is hidden or lost), so only the passive direction asks first.
  function handleToggleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isActive) setPassiveConfirmOpen(true);
    else void handleToggleActive();
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
      // Other pages (calendar, dashboard, category/concept counts) render this channel from their own
      // server data; refresh so the same-session navigation to them doesn't show a stale copy.
      router.refresh();
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
            <ChannelTagBadges categories={categories} concepts={concepts} />
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

          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={studioCustomizeUrl(channel.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover hover:text-ink"
            >
              <Settings2 className="h-3.5 w-3.5" /> Özelleştir
            </a>
            <a
              href={studioVideosUrl(channel.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover hover:text-ink"
            >
              <ListVideo className="h-3.5 w-3.5" /> Videolar
            </a>
          </div>

          {isPlanned && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivateConfirmOpen(true);
              }}
              disabled={toggling}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-300 transition-colors duration-150 hover:border-emerald-400 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Kanalı Aktif Yap
            </button>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-y-1 border-t border-line pt-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-brand disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </button>
            <div className="mr-2 flex items-center gap-0.5">
              <Link
                href={`/channels/${channel.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              {canToggle && (
                <button
                  onClick={handleToggleClick}
                  disabled={toggling}
                  title={isActive ? "Pasife al" : "Aktife al"}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
                    isActive
                      ? "text-ink-muted hover:bg-surface-hover hover:text-ink"
                      : "text-emerald-400 hover:bg-emerald-950/40"
                  }`}
                >
                  {isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
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
        open={activateConfirmOpen}
        title="Kanalı aktif yap"
        description={<ChannelActivateWarning channel={channel} />}
        confirmLabel="Aktif yap"
        danger={false}
        onConfirm={() => changeStatus("active")}
        onCancel={() => setActivateConfirmOpen(false)}
      />

      <ConfirmDialog
        open={passiveConfirmOpen}
        title="Kanalı pasife al"
        description={<ChannelPassiveWarning channel={channel} />}
        confirmLabel="Pasife al"
        onConfirm={handleToggleActive}
        onCancel={() => setPassiveConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Kanalı sil"
        description={<ChannelDeleteWarning channel={channel} />}
        confirmLabel="Sil"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
