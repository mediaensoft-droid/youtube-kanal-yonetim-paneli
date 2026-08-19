import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getChannelById } from "@/lib/db/channels";
import { fetchChannelDetails, ChannelResolutionError, ChannelApiError } from "@/lib/youtube";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.");
  }

  const { id } = await params;
  const channel = await getChannelById(Number(id));
  if (!channel) return errorResponse(404, "Kanal bulunamadı");

  try {
    const details = await fetchChannelDetails(channel.youtubeId, apiKey);
    return okResponse(details);
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
