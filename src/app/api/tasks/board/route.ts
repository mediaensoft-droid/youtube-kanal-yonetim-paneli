import { okResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { ensureDefaultColumns, listBoard } from "@/lib/db/tasks";
import { listMembers } from "@/lib/db/members";
import { listChannels } from "@/lib/db/channels";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  await ensureDefaultColumns(actor.workspaceId);

  const [{ columns, tasks }, members, allChannels] = await Promise.all([
    listBoard(actor.workspaceId),
    listMembers(actor.workspaceId),
    listChannels(actor.workspaceId, { status: "all" }),
  ]);

  // Only assignable channels — passive ones don't show up as a task's channel option.
  const channels = allChannels
    .filter((channel) => channel.status === "active" || channel.status === "planned")
    .map((channel) => ({ id: channel.id, name: channel.name, thumbnailUrl: channel.thumbnailUrl }));

  return okResponse({
    columns,
    tasks,
    members: members.map((member) => ({ id: member.id, displayName: member.displayName })),
    channels,
  });
}
