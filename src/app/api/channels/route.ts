import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { createChannelSchema } from "@/lib/validation";
import {
  listChannels,
  getChannelByYoutubeId,
  createChannel,
} from "@/lib/db/channels";
import {
  resolveToChannelId,
  fetchChannelData,
  canonicalChannelUrl,
  ChannelResolutionError,
  ChannelApiError,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryIdParam = searchParams.get("categoryId");
  const conceptIdParam = searchParams.get("conceptId");

  const channels = await listChannels({
    categoryId: categoryIdParam ? Number(categoryIdParam) : undefined,
    conceptId: conceptIdParam ? Number(conceptIdParam) : undefined,
    language: searchParams.get("language") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  return okResponse(channels);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.");
  }

  const json = await req.json().catch(() => null);
  const parsed = createChannelSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const { input, categoryId, conceptId, languages, countries, notes } = parsed.data;

  try {
    const channelId = await resolveToChannelId(input, apiKey);

    const existing = await getChannelByYoutubeId(channelId);
    if (existing) {
      return errorResponse(409, "Bu kanal zaten listeye eklenmiş.");
    }

    const data = await fetchChannelData(channelId, apiKey);

    const channel = await createChannel({
      youtubeId: data.channelId,
      url: canonicalChannelUrl(data.channelId),
      name: data.title,
      thumbnailUrl: data.thumbnailUrl,
      subscriberCount: data.subscriberCount,
      videoCount: data.videoCount,
      viewCount: data.viewCount,
      categoryId: categoryId ?? null,
      conceptId: conceptId ?? null,
      languages: languages ?? [],
      countries: countries ?? [],
      notes: notes ?? null,
    });

    return okResponse(channel, 201);
  } catch (err) {
    if (err instanceof ChannelResolutionError) {
      return errorResponse(404, err.message);
    }
    if (err instanceof ChannelApiError) {
      return errorResponse(err.reason === "QUOTA_EXCEEDED" ? 429 : 502, err.message);
    }
    return errorResponse(500, "Beklenmeyen bir hata oluştu.");
  }
}
