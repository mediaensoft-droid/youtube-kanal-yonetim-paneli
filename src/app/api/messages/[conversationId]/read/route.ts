import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { markReadSchema } from "@/lib/validation";
import { getConversationById, isParticipant, markRead } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { conversationId } = await params;
  const id = Number(conversationId);
  if (!Number.isInteger(id) || id <= 0) return errorResponse(400, "Geçersiz istek");

  const conversation = await getConversationById(actor.workspaceId, id);
  if (!conversation) return errorResponse(404, "Sohbet bulunamadı");
  if (!isParticipant(conversation, actor.memberId)) {
    return errorResponse(403, "Bu işlem için yetkiniz yok");
  }

  const json = await req.json().catch(() => null);
  const parsed = markReadSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  await markRead(conversation.id, actor.memberId, parsed.data.lastReadMessageId);
  return okResponse({ ok: true });
}
