import "server-only";
import { get, run } from "@/lib/db";

const CACHE_TTL_DAYS = 30;

export interface CachedAnalysis {
  youtubeChannelId: string;
  channelName: string;
  targetAgeGroup: string;
  targetCountry: string;
  thumbnailQuality: string;
  textQuality: string;
  languageGaps: string[];
  rpm: number | null;
  monthlyRevenue: number | null;
  audienceFit: string | null;
  createdAt: string;
}

interface CachedAnalysisRow extends Omit<CachedAnalysis, "languageGaps"> {
  languageGaps: string;
}

export async function getCachedAnalysis(youtubeChannelId: string): Promise<CachedAnalysis | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const row = await get<CachedAnalysisRow>(
    `SELECT * FROM channel_analysis_cache WHERE youtubeChannelId = ? AND createdAt > ?`,
    [youtubeChannelId, cutoff]
  );
  if (!row) return null;
  return { ...row, languageGaps: JSON.parse(row.languageGaps) };
}

export async function upsertCachedAnalysis(
  data: Omit<CachedAnalysis, "createdAt">
): Promise<void> {
  await run(
    `INSERT INTO channel_analysis_cache
      (youtubeChannelId, channelName, targetAgeGroup, targetCountry, thumbnailQuality, textQuality, languageGaps, rpm, monthlyRevenue, audienceFit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(youtubeChannelId) DO UPDATE SET
       channelName = excluded.channelName,
       targetAgeGroup = excluded.targetAgeGroup,
       targetCountry = excluded.targetCountry,
       thumbnailQuality = excluded.thumbnailQuality,
       textQuality = excluded.textQuality,
       languageGaps = excluded.languageGaps,
       rpm = excluded.rpm,
       monthlyRevenue = excluded.monthlyRevenue,
       audienceFit = excluded.audienceFit,
       createdAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [
      data.youtubeChannelId,
      data.channelName,
      data.targetAgeGroup,
      data.targetCountry,
      data.thumbnailQuality,
      data.textQuality,
      JSON.stringify(data.languageGaps),
      data.rpm,
      data.monthlyRevenue,
      data.audienceFit,
    ]
  );
}

export async function updateCachedAudienceFit(
  youtubeChannelId: string,
  audienceFit: string
): Promise<void> {
  await run(`UPDATE channel_analysis_cache SET audienceFit = ? WHERE youtubeChannelId = ?`, [
    audienceFit,
    youtubeChannelId,
  ]);
}
