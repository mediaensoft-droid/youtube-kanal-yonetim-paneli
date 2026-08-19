import "server-only";
import type {
  YouTubeChannelListResponse,
  YouTubeSearchListResponse,
  YouTubePlaylistItemsResponse,
  YouTubeVideoListResponse,
  YouTubeApiErrorBody,
} from "@/types/youtube-api";
import type { ChannelDetails, RecentVideo } from "@/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export class ChannelResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelResolutionError";
  }
}

export class ChannelApiError extends Error {
  constructor(
    public reason: "QUOTA_EXCEEDED" | "FORBIDDEN" | "UNKNOWN",
    message: string
  ) {
    super(message);
    this.name = "ChannelApiError";
  }
}

export type ParsedChannelInput =
  | { type: "id"; value: string }
  | { type: "handle"; value: string }
  | { type: "legacyName"; value: string };

const CHANNEL_ID_RE = /^UC[0-9A-Za-z_-]{22}$/;

export function parseChannelInput(raw: string): ParsedChannelInput {
  const input = raw.trim();

  let m = input.match(/youtube\.com\/channel\/(UC[0-9A-Za-z_-]{22})/i);
  if (m) return { type: "id", value: m[1] };

  if (CHANNEL_ID_RE.test(input)) return { type: "id", value: input };

  m = input.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/i);
  if (m) return { type: "handle", value: `@${m[1]}` };

  if (/^@([A-Za-z0-9_.-]+)$/.test(input)) return { type: "handle", value: input };

  m = input.match(/youtube\.com\/c\/([A-Za-z0-9_.-]+)/i);
  if (m) return { type: "legacyName", value: m[1] };

  m = input.match(/youtube\.com\/user\/([A-Za-z0-9_.-]+)/i);
  if (m) return { type: "legacyName", value: m[1] };

  return { type: "legacyName", value: input };
}

function mapApiError(status: number, body: { error?: YouTubeApiErrorBody }): ChannelApiError {
  const reason = body.error?.errors?.[0]?.reason ?? "";
  if (reason.includes("quota") || status === 429) {
    return new ChannelApiError("QUOTA_EXCEEDED", "YouTube API kotası aşıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (status === 403) {
    return new ChannelApiError("FORBIDDEN", "YouTube API isteği reddedildi. API anahtarını kontrol edin.");
  }
  return new ChannelApiError("UNKNOWN", body.error?.message ?? "YouTube API isteği başarısız oldu.");
}

async function lookupByHandle(handle: string, apiKey: string): Promise<string | null> {
  const url = `${API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeChannelListResponse;
  if (!res.ok) throw mapApiError(res.status, body);
  return body.items?.[0]?.id ?? null;
}

async function lookupByUsername(username: string, apiKey: string): Promise<string | null> {
  const url = `${API_BASE}/channels?part=id&forUsername=${encodeURIComponent(username)}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeChannelListResponse;
  if (!res.ok) throw mapApiError(res.status, body);
  return body.items?.[0]?.id ?? null;
}

async function searchForChannel(query: string, apiKey: string): Promise<string | null> {
  const url = `${API_BASE}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
    query
  )}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeSearchListResponse;
  if (!res.ok) throw mapApiError(res.status, body);
  return body.items?.[0]?.id?.channelId ?? null;
}

export async function resolveToChannelId(input: string, apiKey: string): Promise<string> {
  const parsed = parseChannelInput(input);

  if (parsed.type === "id") return parsed.value;

  if (parsed.type === "handle") {
    const id = await lookupByHandle(parsed.value, apiKey);
    if (id) return id;
    throw new ChannelResolutionError(`Handle bulunamadı: ${parsed.value}`);
  }

  const byUsername = await lookupByUsername(parsed.value, apiKey);
  if (byUsername) return byUsername;

  const bySearch = await searchForChannel(parsed.value, apiKey);
  if (bySearch) return bySearch;

  throw new ChannelResolutionError(`Kanal bulunamadı: ${input}`);
}

export interface YouTubeChannelData {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
}

export async function fetchChannelData(
  channelId: string,
  apiKey: string
): Promise<YouTubeChannelData> {
  const url = `${API_BASE}/channels?part=snippet,statistics&id=${encodeURIComponent(
    channelId
  )}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeChannelListResponse;
  if (!res.ok) throw mapApiError(res.status, body);

  const item = body.items?.[0];
  if (!item) {
    throw new ChannelResolutionError(`Kanal bulunamadı: ${channelId}`);
  }

  const thumbnails = item.snippet?.thumbnails;
  const thumbnailUrl =
    thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? "";

  const stats = item.statistics;
  const subscriberCount = stats?.hiddenSubscriberCount
    ? null
    : stats?.subscriberCount !== undefined
      ? Number(stats.subscriberCount)
      : null;
  const videoCount = stats?.videoCount !== undefined ? Number(stats.videoCount) : null;
  const viewCount = stats?.viewCount !== undefined ? Number(stats.viewCount) : null;

  return {
    channelId: item.id,
    title: item.snippet?.title ?? "",
    thumbnailUrl,
    subscriberCount,
    videoCount,
    viewCount,
  };
}

export function canonicalChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

const ISO_DURATION_RE = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(ISO_DURATION_RE);
  if (!m) return null;
  const hours = Number(m[1] ?? 0);
  const minutes = Number(m[2] ?? 0);
  const seconds = Number(m[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchUploadsPlaylistAndProfile(channelId: string, apiKey: string) {
  const url = `${API_BASE}/channels?part=snippet,contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeChannelListResponse;
  if (!res.ok) throw mapApiError(res.status, body);

  const item = body.items?.[0];
  if (!item) throw new ChannelResolutionError(`Kanal bulunamadı: ${channelId}`);

  return {
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    country: item.snippet?.country ?? null,
    customUrl: item.snippet?.customUrl ?? null,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

async function fetchRecentVideoIds(
  uploadsPlaylistId: string,
  apiKey: string,
  maxResults: number
): Promise<string[]> {
  const url = `${API_BASE}/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(
    uploadsPlaylistId
  )}&maxResults=${maxResults}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubePlaylistItemsResponse;
  if (!res.ok) throw mapApiError(res.status, body);

  return (body.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
}

async function fetchVideoStats(videoIds: string[], apiKey: string): Promise<RecentVideo[]> {
  if (videoIds.length === 0) return [];

  const url = `${API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(
    ","
  )}&key=${apiKey}`;
  const res = await fetch(url);
  const body = (await res.json()) as YouTubeVideoListResponse;
  if (!res.ok) throw mapApiError(res.status, body);

  return (body.items ?? []).map((item) => {
    const thumbnails = item.snippet?.thumbnails;
    return {
      videoId: item.id,
      title: item.snippet?.title ?? "",
      thumbnailUrl: thumbnails?.medium?.url ?? thumbnails?.default?.url ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      viewCount: item.statistics?.viewCount !== undefined ? Number(item.statistics.viewCount) : null,
      likeCount: item.statistics?.likeCount !== undefined ? Number(item.statistics.likeCount) : null,
      commentCount:
        item.statistics?.commentCount !== undefined ? Number(item.statistics.commentCount) : null,
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    };
  });
}

export async function fetchChannelDetails(
  channelId: string,
  apiKey: string,
  maxVideos = 10
): Promise<ChannelDetails> {
  const profile = await fetchUploadsPlaylistAndProfile(channelId, apiKey);

  const videoIds = profile.uploadsPlaylistId
    ? await fetchRecentVideoIds(profile.uploadsPlaylistId, apiKey, maxVideos)
    : [];
  const recentVideos = await fetchVideoStats(videoIds, apiKey);
  // playlistItems returns uploads oldest-fetched-first in some edge cases; sort defensively.
  recentVideos.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  return {
    description: profile.description,
    publishedAt: profile.publishedAt,
    country: profile.country,
    customUrl: profile.customUrl,
    recentVideos,
  };
}
