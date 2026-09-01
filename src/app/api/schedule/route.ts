import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { upsertScheduleEntrySchema } from "@/lib/validation";
import { listScheduleEntries, upsertScheduleEntry } from "@/lib/db/schedule";
import { getChannelById } from "@/lib/db/channels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) return errorResponse(400, "start ve end parametreleri gerekli");

  return okResponse(await listScheduleEntries(userId, start, end));
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const json = await req.json().catch(() => null);
  const parsed = upsertScheduleEntrySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const channel = await getChannelById(userId, parsed.data.channelId);
  if (!channel) return errorResponse(404, "Kanal bulunamadı");

  const entry = await upsertScheduleEntry(userId, parsed.data);
  return okResponse(entry, 201);
}
