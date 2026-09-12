import { okResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { unreadCountsForMember } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const byConversation = await unreadCountsForMember(actor.workspaceId, actor.memberId);
  const total = Object.values(byConversation).reduce((sum, n) => sum + n, 0);

  return okResponse({ total, byConversation });
}
