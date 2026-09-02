"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Globe2,
  Link as LinkIcon,
  Eye,
  ThumbsUp,
  MessageCircle,
  RefreshCw,
  Repeat,
  ExternalLink,
} from "lucide-react";
import type { ChannelDetails, RecentVideo } from "@/types";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/StatTile";
import { formatCompactNumber, formatDate, formatDuration } from "@/lib/format";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";
import { studioVideoEditUrl } from "@/lib/studioLinks";

interface ChannelDetailsClientProps {
  channelId: number;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ChannelDetails };

function computeAverageViews(videos: RecentVideo[]): number | null {
  const views = videos.map((v) => v.viewCount).filter((v): v is number => v !== null);
  if (views.length === 0) return null;
  return Math.round(views.reduce((sum, v) => sum + v, 0) / views.length);
}

function computeUploadFrequency(videos: RecentVideo[]): string | null {
  const timestamps = videos
    .map((v) => new Date(v.publishedAt).getTime())
    .filter((t) => !Number.isNaN(t));
  if (timestamps.length < 2) return null;

  const spanDays = (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24);
  const avgDaysBetween = spanDays / (timestamps.length - 1);
  if (avgDaysBetween <= 0) return null;

  if (avgDaysBetween < 1.5) return "Günde ~1 video";
  if (avgDaysBetween <= 9) {
    const perWeek = 7 / avgDaysBetween;
    return perWeek >= 1.05 ? `Haftada ~${perWeek.toFixed(1)} video` : "Haftada ~1 video";
  }
  const perMonth = 30 / avgDaysBetween;
  return perMonth >= 1.05 ? `Ayda ~${perMonth.toFixed(1)} video` : `~${Math.round(avgDaysBetween)} günde 1 video`;
}

export function ChannelDetailsClient({ channelId }: ChannelDetailsClientProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  async function load() {
    try {
      const res = await fetch(`/api/channels/${channelId}/details`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Detaylar yüklenemedi");
      setState({ status: "ready", data });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Detaylar yüklenemedi",
      });
    }
  }

  function retry() {
    setState({ status: "loading" });
    load();
  }

  useEffect(() => {
    // The "Son Videolar" section this hash points to only exists once `state` is "ready" —
    // it's rendered from a fetch below, not present at initial page load — so the browser's
    // native fragment-scroll (which only fires once, during load) misses it. Do it manually here.
    if (state.status === "ready" && window.location.hash === "#son-videolar") {
      document.getElementById("son-videolar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  useEffect(() => {
    // load() only calls setState after its internal `await`, never synchronously —
    // this is the standard fetch-on-mount pattern, not the cascading-render case the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  if (state.status === "loading") {
    return (
      <div className="mt-6 flex items-center justify-center rounded-lg border border-line bg-surface py-16 text-sm text-ink-muted">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> YouTube&apos;dan detaylar çekiliyor...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-line bg-surface py-12 text-center">
        <p className="text-sm text-red-400">{state.message}</p>
        <Button variant="secondary" size="sm" onClick={retry}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  const { data } = state;
  const avgViews = computeAverageViews(data.recentVideos);
  const uploadFrequency = computeUploadFrequency(data.recentVideos);

  return (
    <div className="mt-6 space-y-6">
      {(avgViews !== null || uploadFrequency !== null) && (
        <div>
          <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label="Ortalama İzlenme"
              value={avgViews !== null ? formatCompactNumber(avgViews) : "—"}
              icon={<Eye className="h-5 w-5" />}
            />
            <StatTile
              label="Yükleme Sıklığı"
              value={uploadFrequency ?? "—"}
              icon={<Repeat className="h-5 w-5" />}
            />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Son {data.recentVideos.length} videoya göre hesaplanmıştır.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">Kanal Bilgileri</h2>
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Katılım: {formatDate(data.publishedAt)}
          </span>
          {data.country && (
            <span className="flex items-center gap-1.5">
              <Globe2 className="h-4 w-4" /> {countryFlagEmoji(data.country)} {getCountryName(data.country)}
            </span>
          )}
          {data.customUrl && (
            <span className="flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" /> {data.customUrl}
            </span>
          )}
        </div>
        {data.description && (
          <p className="whitespace-pre-line text-sm text-ink-muted">{data.description}</p>
        )}
      </div>

      <div id="son-videolar" className="scroll-mt-20">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">Son Videolar</h2>
        {data.recentVideos.length === 0 ? (
          <p className="text-sm text-ink-faint">Video bulunamadı.</p>
        ) : (
          <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentVideos.map((video) => (
              <div
                key={video.videoId}
                className="group overflow-hidden rounded-lg border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-xl hover:shadow-black/30"
              >
                <a
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-video w-full overflow-hidden bg-surface-2"
                >
                  {video.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  {video.durationSeconds !== null && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  )}
                </a>
                <div className="p-3">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium text-ink hover:text-brand"
                    title={video.title}
                  >
                    {video.title}
                  </a>
                  <p className="mt-1 text-xs text-ink-faint">{formatDate(video.publishedAt)}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {formatCompactNumber(video.viewCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" /> {formatCompactNumber(video.likeCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {formatCompactNumber(video.commentCount)}
                    </span>
                  </div>
                  <a
                    href={studioVideoEditUrl(video.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-brand"
                  >
                    <ExternalLink className="h-3 w-3" /> Video ayrıntıları
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
