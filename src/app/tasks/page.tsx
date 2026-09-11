import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { can } from "@/lib/roles";
import { ensureDefaultColumns, listBoard } from "@/lib/db/tasks";
import { listMembers } from "@/lib/db/members";
import { listChannels } from "@/lib/db/channels";
import { TaskBoard } from "./TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");
  const userId = actor.workspaceId;

  await ensureDefaultColumns(userId);

  const [{ columns, tasks }, members, allChannels] = await Promise.all([
    listBoard(userId),
    listMembers(userId),
    listChannels(userId, { status: "all" }),
  ]);

  // Passive channels aren't assignable; active + planned are (same rule as GET /api/tasks/board).
  const channels = allChannels
    .filter((channel) => channel.status !== "passive")
    .map((channel) => ({ id: channel.id, name: channel.name, thumbnailUrl: channel.thumbnailUrl }));

  return (
    <TaskBoard
      initialColumns={columns}
      initialTasks={tasks}
      members={members.map((member) => ({ id: member.id, displayName: member.displayName, status: member.status }))}
      channels={channels}
      readOnly={!can(actor.role, "task.write")}
      canDelete={can(actor.role, "task.delete")}
      currentMemberId={actor.memberId}
    />
  );
}
