import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { requirePermission, isResponse } from "@/lib/authz";
import { hasActiveAccess, getChannelLimit, getPlannedChannelLimit } from "@/lib/access";
import { createChannelSchema } from "@/lib/validation";
import {
  listChannels,
  getChannelByYoutubeId,
  createChannel,
  countChannelsForUser,
  countPlannedChannelsForUser,
} from "@/lib/db/channels";
import { createSnapshot } from "@/lib/db/snapshots";
import { logActivity } from "@/lib/db/activity";
import {
  resolveToChannelId,
  fetchChannelData,
  canonicalChannelUrl,
  ChannelResolutionError,
  ChannelApiError,
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { searchParams } = new URL(req.url);
  const categoryIdParam = searchParams.get("categoryId");
  const conceptIdParam = searchParams.get("conceptId");

  const statusParam = searchParams.get("status");
  const channels = await listChannels(userId, {
    status:
      statusParam === "passive" || statusParam === "all" || statusParam === "active"
        ? statusParam
        : undefined,
    categoryId: categoryIdParam ? Number(categoryIdParam) : undefined,
    conceptId: conceptIdParam ? Number(conceptIdParam) : undefined,
    language: searchParams.get("language") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  return okResponse(channels);
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission("channel.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;
  if (!(await hasActiveAccess(userId))) {
    return errorResponse(402, "Deneme süreniz doldu. Devam etmek için üyeliğinizi başlatın.");
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.");
  }

  const json = await req.json().catch(() => null);
  const parsed = createChannelSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const { input, categoryIds, conceptIds, languages, countries, notes } = parsed.data;
  const status = parsed.data.status ?? "active";

  // Own channels and planned (reference) channels draw from separate plan allowances.
  if (status === "planned") {
    const plannedLimit = await getPlannedChannelLimit(userId);
    if (plannedLimit !== null) {
      const currentCount = await countPlannedChannelsForUser(userId);
      if (currentCount >= plannedLimit) {
        return errorResponse(
          402,
          `Planlanan kanal limitinize ulaştınız (${currentCount}/${plannedLimit}). Daha fazla planlanan kanal eklemek için planınızı yükseltin.`
        );
      }
    }
  } else {
    const channelLimit = await getChannelLimit(userId);
    if (channelLimit !== null) {
      const currentCount = await countChannelsForUser(userId);
      if (currentCount >= channelLimit) {
        return errorResponse(
          402,
          `Plan kanal limitinize ulaştınız (${currentCount}/${channelLimit}). Daha fazla kanal eklemek için planınızı yükseltin.`
        );
      }
    }
  }

  try {
    const channelId = await resolveToChannelId(input, apiKey);

    const existing = await getChannelByYoutubeId(userId, channelId);
    if (existing) {
      return errorResponse(409, "Bu kanal zaten listeye eklenmiş.");
    }

    const data = await fetchChannelData(channelId, apiKey);

    const channel = await createChannel(userId, {
      youtubeId: data.channelId,
      url: canonicalChannelUrl(data.channelId),
      name: data.title,
      thumbnailUrl: data.thumbnailUrl,
      subscriberCount: data.subscriberCount,
      videoCount: data.videoCount,
      viewCount: data.viewCount,
      categoryIds: categoryIds ?? [],
      conceptIds: conceptIds ?? [],
      languages: languages ?? [],
      countries: countries ?? [],
      notes: notes ?? null,
      status,
      createdByMemberId: actor.memberId,
    });

    await createSnapshot(channel.id, {
      subscriberCount: data.subscriberCount,
      videoCount: data.videoCount,
      viewCount: data.viewCount,
    });

    await logActivity(
      { workspaceId: userId, memberId: actor.memberId },
      {
        action: "channel.create",
        entityType: "channel",
        entityId: channel.id,
        entityName: channel.name,
        details: { status },
      }
    );

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
