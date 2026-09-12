import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { createDmSchema } from "@/lib/validation";
import { getMemberById } from "@/lib/db/members";
import { getConversationsSummary, getOrCreateDm } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const summary = await getConversationsSummary(actor.workspaceId, actor.memberId);
  return okResponse(summary);
}

export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = createDmSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const { memberId } = parsed.data;
  if (memberId === actor.memberId) {
    return errorResponse(400, "Kendinizle sohbet başlatamazsınız");
  }

  const target = await getMemberById(memberId);
  if (!target || target.userId !== actor.workspaceId) {
    return errorResponse(404, "Üye bulunamadı");
  }

  const conversation = await getOrCreateDm(actor.workspaceId, actor.memberId, memberId);
  return okResponse({ conversationId: conversation.id }, 201);
}
