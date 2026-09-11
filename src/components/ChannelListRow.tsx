"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Pencil,
  Trash2,
  BarChart3,
  Settings2,
  ListVideo,
  Users,
  Video,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import type { Channel, Category, Concept } from "@/types";
import { ChannelTagBadges } from "@/components/ChannelTagBadges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ChannelDeleteWarning } from "@/components/ChannelDeleteWarning";
import { ChannelPassiveWarning } from "@/components/ChannelPassiveWarning";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";
import { formatCompactNumber } from "@/lib/format";
import { studioCustomizeUrl, studioVideosUrl } from "@/lib/studioLinks";
import { useActor } from "@/lib/useActor";

interface ChannelListRowProps {
  channel: Channel;
  categories: Category[];
  concepts: Concept[];
  onRefreshed: (channel: Channel) => void;
  onDeleted: (id: number) => void;
  /** Fired after the channel flips active⇄passive; the list drops it since it now belongs to the other screen. */
  onStatusChanged: (id: number) => void;
}

export function ChannelListRow({ channel, categories, concepts, onRefreshed, onDeleted, onStatusChanged }: ChannelListRowProps) {
  const router = useRouter();
  const { can } = useActor();
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [passiveConfirmOpen, setPassiveConfirmOpen] = useState(false);

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
  // Planned (reference) channels aren't the user's own, so parking them makes no sense.
  const canToggle = channel.status !== "planned";

  async function handleToggleActive() {
    const nextStatus = isActive ? "passive" : "active";
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
      toast.success(nextStatus === "active" ? "Kanal aktife alındı" : "Kanal pasife alındı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız oldu");
    } finally {
      setToggling(false);
      setPassiveConfirmOpen(false);
    }
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
        className="group flex cursor-pointer flex-col gap-3 rounded-lg border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
            {channel.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.thumbnailUrl}
                alt={channel.name}
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-ink" title={channel.name}>
                {channel.name}
              </h3>
              <ChannelTagBadges categories={categories} concepts={concepts} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {formatCompactNumber(channel.subscriberCount)}
              </span>
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" /> {formatCompactNumber(channel.videoCount)}
              </span>
              {channel.languages.map((code) => (
                <span key={`lang-${code}`}>{getLanguageName(code)}</span>
              ))}
              {channel.countries.map((code) => (
                <span key={`country-${code}`}>
                  {countryFlagEmoji(code)} {getCountryName(code)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-line pt-2 sm:border-t-0 sm:pt-0">
          {can("channel.write") && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Yenile"
              className="flex items-center gap-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-brand disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
          <Link
            href={`/channels/${channel.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Detaylar"
            className="flex items-center gap-1 rounded-md p-2 text-brand transition-colors duration-150 hover:bg-brand-soft"
          >
            <BarChart3 className="h-4 w-4" />
          </Link>
          {can("channel.write") && (
            <Link
              href={`/channels/${channel.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              title="Düzenle"
              className="flex items-center gap-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          <a
            href={studioCustomizeUrl(channel.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Kanalı özelleştir"
            className="flex items-center gap-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
          >
            <Settings2 className="h-4 w-4" />
          </a>
          <a
            href={studioVideosUrl(channel.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Videoları yönet"
            className="flex items-center gap-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
          >
            <ListVideo className="h-4 w-4" />
          </a>
          {canToggle && can("channel.write") && (
            <button
              onClick={handleToggleClick}
              disabled={toggling}
              title={isActive ? "Pasife al" : "Aktife al"}
              className={`flex items-center gap-1 rounded-md p-2 transition-colors duration-150 disabled:opacity-50 ${
                isActive
                  ? "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  : "text-emerald-400 hover:bg-emerald-950/40"
              }`}
            >
              {isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {can("channel.delete") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
              disabled={deleting}
              title="Sil"
              className="flex items-center gap-1 rounded-md p-2 text-red-400 transition-colors duration-150 hover:bg-red-950/40 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

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
