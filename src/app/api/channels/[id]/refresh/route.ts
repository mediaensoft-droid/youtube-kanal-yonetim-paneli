import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { hasActiveAccess } from "@/lib/access";
import { getChannelById, updateChannelYouTubeData } from "@/lib/db/channels";
import { createSnapshot } from "@/lib/db/snapshots";
import { fetchChannelData, ChannelResolutionError, ChannelApiError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  if (!(await hasActiveAccess(userId))) {
    return errorResponse(402, "Deneme süreniz doldu. Devam etmek için üyeliğinizi başlatın.");
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.");
  }

  const { id } = await params;
  const channelId = Number(id);
  const existing = await getChannelById(userId, channelId);
  if (!existing) return errorResponse(404, "Kanal bulunamadı");

  try {
    const data = await fetchChannelData(existing.youtubeId, apiKey);
    const channel = await updateChannelYouTubeData(userId, channelId, {
      name: data.title,
      thumbnailUrl: data.thumbnailUrl,
      subscriberCount: data.subscriberCount,
      videoCount: data.videoCount,
      viewCount: data.viewCount,
    });
    await createSnapshot(channelId, {
      subscriberCount: data.subscriberCount,
      videoCount: data.videoCount,
      viewCount: data.viewCount,
    });
    return okResponse(channel);
  } catch (err) {
    if (err instanceof ChannelResolutionError) {
      return errorResponse(404, "Bu kanal YouTube'da artık bulunamıyor (silinmiş olabilir).");
    }
    if (err instanceof ChannelApiError) {
      return errorResponse(err.reason === "QUOTA_EXCEEDED" ? 429 : 502, err.message);
    }
    return errorResponse(500, "Beklenmeyen bir hata oluştu.");
  }
}
