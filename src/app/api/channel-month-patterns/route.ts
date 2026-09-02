import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { upsertChannelMonthPatternSchema } from "@/lib/validation";
import { listChannelMonthPatterns, upsertChannelMonthPattern } from "@/lib/db/channelMonthPatterns";
import { getChannelById } from "@/lib/db/channels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) return errorResponse(400, "start ve end parametreleri gerekli");

  return okResponse(await listChannelMonthPatterns(userId, start, end));
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const json = await req.json().catch(() => null);
  const parsed = upsertChannelMonthPatternSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const channel = await getChannelById(userId, parsed.data.channelId);
  if (!channel) return errorResponse(404, "Kanal bulunamadı");

  const pattern = await upsertChannelMonthPattern(
    userId,
    parsed.data.channelId,
    parsed.data.yearMonth,
    parsed.data.publishDays
  );
  return okResponse(pattern, 201);
}
