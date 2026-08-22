import { NextRequest } from "next/server";
import { errorResponse, okResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { hasUltraAccess } from "@/lib/access";
import { resolveToChannelId, fetchChannelDetails, ChannelResolutionError } from "@/lib/youtube";
import {
  getChannelAbout,
  getGeoDemoRev,
  formatTopAgeGroup,
  formatTopCountry,
  detectLanguageGap,
  NexlevApiError,
} from "@/lib/nexlev";
import { analyzeContentQuality } from "@/lib/contentQuality";
import { getCachedAnalysis, upsertCachedAnalysis } from "@/lib/db/analysisCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface ChannelAnalysisResult {
  channelId: string;
  channelName: string;
  targetAgeGroup: string;
  targetCountry: string;
  thumbnailQuality: string;
  textQuality: string;
  audienceFit: string | null;
  languageGaps: string[];
  rpm: number | null;
  monthlyRevenue: number | null;
  fromCache: boolean;
}

interface QualityScores {
  thumbnailQuality: string;
  textQuality: string;
}

async function getQualityScores(
  channelName: string,
  description: string,
  videoTitles: string[],
  thumbnailUrls: string[]
): Promise<QualityScores> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { thumbnailQuality: "—", textQuality: "—" };
  }
  try {
    const result = await analyzeContentQuality({ channelName, description, videoTitles, thumbnailUrls });
    return {
      thumbnailQuality:
        result.thumbnailScore !== null ? `${result.thumbnailScore}/10 — ${result.thumbnailNotes}` : "—",
      textQuality: result.textScore !== null ? `${result.textScore}/10 — ${result.textNotes}` : "—",
    };
  } catch {
    return { thumbnailQuality: "—", textQuality: "—" };
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  if (!(await hasUltraAccess(userId))) {
    return errorResponse(403, "Bu özellik yalnızca Ultra plan için geçerli.");
  }

  const json = await req.json().catch(() => null);
  const url = typeof json?.url === "string" ? json.url.trim() : "";
  if (!url) return errorResponse(400, "Kanal linki gerekli.");

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil.");
  }

  try {
    const channelId = await resolveToChannelId(url, youtubeApiKey);

    // Serve from cache when available — NexLev's geography-revenue endpoint alone costs 20
    // units per call, so repeat lookups of the same channel (likely across subscribers) must
    // not re-spend quota.
    const cached = await getCachedAnalysis(channelId);
    if (cached) {
      const result: ChannelAnalysisResult = {
        channelId,
        channelName: cached.channelName,
        targetAgeGroup: cached.targetAgeGroup,
        targetCountry: cached.targetCountry,
        thumbnailQuality: cached.thumbnailQuality,
        textQuality: cached.textQuality,
        audienceFit: cached.audienceFit,
        languageGaps: cached.languageGaps,
        rpm: cached.rpm,
        monthlyRevenue: cached.monthlyRevenue,
        fromCache: true,
      };
      return okResponse(result);
    }

    if (!process.env.NEXLEV_API_KEY) {
      return errorResponse(
        503,
        "Kanal analiz özelliği henüz aktif değil — NexLev entegrasyonu yapılandırma aşamasında."
      );
    }

    const [about, geoDemoRev, details] = await Promise.all([
      getChannelAbout(channelId),
      getGeoDemoRev(channelId),
      fetchChannelDetails(channelId, youtubeApiKey).catch(() => null),
    ]);

    const quality = await getQualityScores(
      about.title,
      details?.description ?? about.description ?? "",
      (details?.recentVideos ?? []).map((v) => v.title),
      (details?.recentVideos ?? []).map((v) => v.thumbnailUrl)
    );

    const result: ChannelAnalysisResult = {
      channelId,
      channelName: about.title,
      targetAgeGroup: formatTopAgeGroup(geoDemoRev.demographics.age),
      targetCountry: formatTopCountry(geoDemoRev.demographics.viewership_country),
      thumbnailQuality: quality.thumbnailQuality,
      textQuality: quality.textQuality,
      audienceFit: null,
      languageGaps: detectLanguageGap(
        geoDemoRev.revenue.channel_language_code,
        geoDemoRev.demographics.viewership_country
      ),
      rpm: geoDemoRev.rpm?.rpm_45 ?? null,
      monthlyRevenue: geoDemoRev.revenue?.month_revenue ?? null,
      fromCache: false,
    };

    await upsertCachedAnalysis({
      youtubeChannelId: result.channelId,
      channelName: result.channelName,
      targetAgeGroup: result.targetAgeGroup,
      targetCountry: result.targetCountry,
      thumbnailQuality: result.thumbnailQuality,
      textQuality: result.textQuality,
      languageGaps: result.languageGaps,
      rpm: result.rpm,
      monthlyRevenue: result.monthlyRevenue,
      audienceFit: result.audienceFit,
    });

    return okResponse(result);
  } catch (err) {
    if (err instanceof ChannelResolutionError) {
      return errorResponse(404, err.message);
    }
    if (err instanceof NexlevApiError) {
      return errorResponse(502, err.message);
    }
    return errorResponse(500, "Beklenmeyen bir hata oluştu.");
  }
}
