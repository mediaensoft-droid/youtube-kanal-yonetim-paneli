import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { createDmSchema } from "@/lib/validation";
import { listMembers, getMemberById } from "@/lib/db/members";
import {
  listConversationsForMember,
  unreadCountsForMember,
  getOrCreateDm,
} from "@/lib/db/messages";
import type { ConversationsResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const [members, { general, dms }, unread] = await Promise.all([
    listMembers(actor.workspaceId),
    listConversationsForMember(actor.workspaceId, actor.memberId),
    unreadCountsForMember(actor.workspaceId, actor.memberId),
  ]);

  const dmByOtherMemberId = new Map(dms.map((dm) => [dm.otherMemberId, dm]));

  const dmList = members
    .filter((member) => member.id !== actor.memberId)
    .filter((member) => member.status === "active" || dmByOtherMemberId.has(member.id))
    .map((member) => {
      const dm = dmByOtherMemberId.get(member.id);
      return {
        memberId: member.id,
        displayName: member.displayName,
        status: member.status,
        conversationId: dm?.conversationId ?? null,
        unread: dm ? unread[dm.conversationId] ?? 0 : 0,
        lastMessageAt: dm?.lastMessageAt ?? null,
      };
    })
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.displayName.localeCompare(b.displayName, "tr");
    });

  const response: ConversationsResponse = {
    general: { id: general.id, unread: unread[general.id] ?? 0 },
    dms: dmList,
  };

  return okResponse(response);
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
