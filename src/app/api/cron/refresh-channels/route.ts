import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { listChannels, updateChannelYouTubeData } from "@/lib/db/channels";
import { createSnapshot } from "@/lib/db/snapshots";
import { fetchChannelData, ChannelApiError } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Triggered daily by Vercel Cron (see vercel.json). Refreshes every tracked channel's
// YouTube stats and records a snapshot, so growth trend charts fill in even if nobody
// clicks "Yenile" manually.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return errorResponse(401, "Unauthorized");
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "YOUTUBE_API_KEY tanımlı değil.");
  }

  const channels = await listChannels();
  let succeeded = 0;
  let failed = 0;
  let quotaExceeded = false;

  for (const channel of channels) {
    try {
      const data = await fetchChannelData(channel.youtubeId, apiKey);
      await updateChannelYouTubeData(channel.id, {
        name: data.title,
        thumbnailUrl: data.thumbnailUrl,
        subscriberCount: data.subscriberCount,
        videoCount: data.videoCount,
        viewCount: data.viewCount,
      });
      await createSnapshot(channel.id, {
        subscriberCount: data.subscriberCount,
        videoCount: data.videoCount,
        viewCount: data.viewCount,
      });
      succeeded++;
    } catch (err) {
      failed++;
      if (err instanceof ChannelApiError && err.reason === "QUOTA_EXCEEDED") {
        quotaExceeded = true;
        break;
      }
    }
  }

  return okResponse({ total: channels.length, succeeded, failed, quotaExceeded });
}
