import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { updateChannelSchema } from "@/lib/validation";
import { getChannelById, updateChannelManualFields, deleteChannel } from "@/lib/db/channels";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const channel = await getChannelById(Number(id));
  if (!channel) return errorResponse(404, "Kanal bulunamadı");
  return okResponse(channel);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const channelId = Number(id);
  const existing = await getChannelById(channelId);
  if (!existing) return errorResponse(404, "Kanal bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateChannelSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const channel = await updateChannelManualFields(channelId, parsed.data);
  return okResponse(channel);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const channelId = Number(id);
  const existing = await getChannelById(channelId);
  if (!existing) return errorResponse(404, "Kanal bulunamadı");

  await deleteChannel(channelId);
  return new Response(null, { status: 204 });
}
