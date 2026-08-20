import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { updateChannelSchema } from "@/lib/validation";
import { getChannelById, updateChannelManualFields, deleteChannel } from "@/lib/db/channels";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { id } = await params;
  const channel = await getChannelById(userId, Number(id));
  if (!channel) return errorResponse(404, "Kanal bulunamadı");
  return okResponse(channel);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { id } = await params;
  const channelId = Number(id);
  const existing = await getChannelById(userId, channelId);
  if (!existing) return errorResponse(404, "Kanal bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateChannelSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const channel = await updateChannelManualFields(userId, channelId, parsed.data);
  return okResponse(channel);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { id } = await params;
  const channelId = Number(id);
  const existing = await getChannelById(userId, channelId);
  if (!existing) return errorResponse(404, "Kanal bulunamadı");

  await deleteChannel(userId, channelId);
  return new Response(null, { status: 204 });
}
