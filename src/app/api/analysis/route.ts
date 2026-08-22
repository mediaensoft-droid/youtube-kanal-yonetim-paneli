import { NextRequest } from "next/server";
import { errorResponse, okResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { hasUltraAccess } from "@/lib/access";
import { resolveToChannelId, ChannelResolutionError } from "@/lib/youtube";
import {
  getChannelAbout,
  getGeoDemoRev,
  createChannelAnalysisJob,
  getChannelAnalysisJobStatus,
  formatTopAgeGroup,
  formatTopCountry,
  detectLanguageGap,
  NexlevApiError,
} from "@/lib/nexlev";

export const dynamic = "force-dynamic";

export interface ChannelAnalysisResult {
  channelName: string;
  targetAgeGroup: string;
  targetCountry: string;
  thumbnailQuality: string;
  textQuality: string;
  audienceFit: string;
  languageGaps: string[];
  rpm: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAudienceFit(channelId: string): Promise<string> {
  try {
    const job = await createChannelAnalysisJob(channelId);
    for (const delayMs of [0, 1500, 2500, 3000]) {
      if (delayMs) await sleep(delayMs);
      const status = await getChannelAnalysisJobStatus(job.job_id);
      const sentiment = status.result?.strategic_insights?.audience_insights?.sentiment_summary;
      if (status.status === "completed" && sentiment?.overall_sentiment) {
        return `${sentiment.overall_sentiment} (etkileşim: ${sentiment.engagement_level ?? "—"})`;
      }
      if (status.status === "failed") break;
    }
  } catch {
    // fall through — audience fit is best-effort, not fatal to the rest of the report
  }
  return "Analiz zaman aşımına uğradı";
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

  if (!process.env.NEXLEV_API_KEY) {
    return errorResponse(
      503,
      "Kanal analiz özelliği henüz aktif değil — NexLev entegrasyonu yapılandırma aşamasında."
    );
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil.");
  }

  try {
    const channelId = await resolveToChannelId(url, youtubeApiKey);

    const [about, geoDemoRev, audienceFit] = await Promise.all([
      getChannelAbout(channelId),
      getGeoDemoRev(channelId),
      getAudienceFit(channelId),
    ]);

    const result: ChannelAnalysisResult = {
      channelName: about.title,
      targetAgeGroup: formatTopAgeGroup(geoDemoRev.demographics.age),
      targetCountry: formatTopCountry(geoDemoRev.demographics.viewership_country),
      thumbnailQuality: "—",
      textQuality: "—",
      audienceFit,
      languageGaps: detectLanguageGap(
        geoDemoRev.revenue.channel_language_code,
        geoDemoRev.demographics.viewership_country
      ),
      rpm: geoDemoRev.rpm?.rpm_45 ?? null,
    };

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
