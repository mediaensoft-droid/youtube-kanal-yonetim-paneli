import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { ensureGeneralConversation, getConversationsSummary } from "@/lib/db/messages";
import { MessagesClient } from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");

  // The workspace's general conversation is created lazily on first visit to this screen.
  await ensureGeneralConversation(actor.workspaceId);
  const initialConversations = await getConversationsSummary(actor.workspaceId, actor.memberId);

  return <MessagesClient initialConversations={initialConversations} currentMemberId={actor.memberId} />;
}
