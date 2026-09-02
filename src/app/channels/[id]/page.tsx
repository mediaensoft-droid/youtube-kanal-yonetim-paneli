import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Settings2, ListVideo, Users, Video, Eye } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { getChannelById } from "@/lib/db/channels";
import { getCategoryById } from "@/lib/db/categories";
import { getConceptById } from "@/lib/db/concepts";
import { listSnapshots } from "@/lib/db/snapshots";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatCompactNumber } from "@/lib/format";
import { getLanguageName } from "@/lib/constants/languages";
import { getCountryName, countryFlagEmoji } from "@/lib/constants/countries";
import { studioCustomizeUrl, studioVideosUrl } from "@/lib/studioLinks";
import { ChannelDetailsClient } from "./ChannelDetailsClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelDetailPage({ params }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const channel = await getChannelById(userId, Number(id));
  if (!channel) notFound();

  const [category, concept, snapshots] = await Promise.all([
    channel.categoryId ? getCategoryById(userId, channel.categoryId) : undefined,
    channel.conceptId ? getConceptById(userId, channel.conceptId) : undefined,
    listSnapshots(channel.id),
  ]);

  const subscriberTrend = snapshots.map((s) => ({ capturedAt: s.capturedAt, value: s.subscriberCount }));
  const viewTrend = snapshots.map((s) => ({ capturedAt: s.capturedAt, value: s.viewCount }));

  return (
    <div className="animate-fade-in-up mx-auto max-w-3xl">
      <Link
        href="/channels"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kanallara dön
      </Link>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row">
        <a href={channel.url} target="_blank" rel="noopener noreferrer" title="YouTube'da aç" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={channel.thumbnailUrl}
            alt={channel.name}
            className="h-24 w-24 rounded-full object-cover transition-opacity duration-150 hover:opacity-80"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{channel.name}</h1>
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-ink-muted transition-colors duration-150 hover:text-brand"
            >
              YouTube&apos;da aç <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {formatCompactNumber(channel.subscriberCount)} abone
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-4 w-4" /> {formatCompactNumber(channel.videoCount)} video
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" /> {formatCompactNumber(channel.viewCount)} görüntülenme
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {category ? (
              <CategoryBadge name={category.name} color={category.color} />
            ) : (
              <span className="text-xs text-ink-faint">Kategorisiz</span>
            )}
            {concept && <CategoryBadge name={concept.name} color={concept.color} />}
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

          {channel.notes && <p className="mt-3 text-sm text-ink-muted">{channel.notes}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={studioCustomizeUrl(channel.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover hover:text-ink"
            >
              <Settings2 className="h-3.5 w-3.5" /> Kanalı Özelleştir
            </a>
            <a
              href={studioVideosUrl(channel.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover hover:text-ink"
            >
              <ListVideo className="h-3.5 w-3.5" /> Videoları Yönet
            </a>
          </div>
        </div>
      </div>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">Abone Trendi</h2>
          <TrendChart data={subscriberTrend} color="#4DA3FF" />
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">Görüntülenme Trendi</h2>
          <TrendChart data={viewTrend} color="#2DD4BF" />
        </div>
      </div>

      <ChannelDetailsClient channelId={channel.id} />
    </div>
  );
}
