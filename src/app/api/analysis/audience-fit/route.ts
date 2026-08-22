import { NextRequest } from "next/server";
import { errorResponse, okResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { hasUltraAccess } from "@/lib/access";
import { createChannelAnalysisJob, getChannelAnalysisJobStatus, NexlevApiError } from "@/lib/nexlev";
import { getCachedAnalysis, updateCachedAudienceFit } from "@/lib/db/analysisCache";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The channel-analysis job (20 NexLev units) is only run on explicit request — it's the most
// expensive call in the whole analysis flow, so it's kept opt-in rather than automatic.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  if (!(await hasUltraAccess(userId))) {
    return errorResponse(403, "Bu özellik yalnızca Ultra plan için geçerli.");
  }

  const json = await req.json().catch(() => null);
  const channelId = typeof json?.channelId === "string" ? json.channelId.trim() : "";
  if (!channelId) return errorResponse(400, "channelId gerekli.");

  const cached = await getCachedAnalysis(channelId);
  if (cached?.audienceFit) {
    return okResponse({ audienceFit: cached.audienceFit });
  }
  if (!cached) {
    return errorResponse(404, "Önce kanalı analiz edin.");
  }

  if (!process.env.NEXLEV_API_KEY) {
    return errorResponse(503, "NexLev entegrasyonu yapılandırılmadı.");
  }

  try {
    const job = await createChannelAnalysisJob(channelId);
    for (const delayMs of [0, 1500, 2500, 3000, 3000]) {
      if (delayMs) await sleep(delayMs);
      const status = await getChannelAnalysisJobStatus(job.job_id);
      const sentiment = status.result?.strategic_insights?.audience_insights?.sentiment_summary;
      if (status.status === "completed" && sentiment?.overall_sentiment) {
        const audienceFit = `${sentiment.overall_sentiment} (etkileşim: ${sentiment.engagement_level ?? "—"})`;
        await updateCachedAudienceFit(channelId, audienceFit);
        return okResponse({ audienceFit });
      }
      if (status.status === "failed") break;
    }
    return errorResponse(504, "Analiz zaman aşımına uğradı, tekrar deneyin.");
  } catch (err) {
    if (err instanceof NexlevApiError) {
      return errorResponse(502, err.message);
    }
    return errorResponse(500, "Beklenmeyen bir hata oluştu.");
  }
}
