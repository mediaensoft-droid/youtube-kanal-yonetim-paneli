import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { createTaskSchema } from "@/lib/validation";
import { createTask, getColumnById } from "@/lib/db/tasks";
import { getMemberById } from "@/lib/db/members";
import { getChannelById } from "@/lib/db/channels";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const input = parsed.data;

  const column = await getColumnById(actor.workspaceId, input.columnId);
  if (!column) return errorResponse(404, "Sütun bulunamadı");

  if (input.assigneeMemberId !== null && input.assigneeMemberId !== undefined) {
    const member = await getMemberById(input.assigneeMemberId);
    if (!member || member.userId !== actor.workspaceId) {
      return errorResponse(404, "Üye bulunamadı");
    }
  }
  if (input.channelId !== null && input.channelId !== undefined) {
    const channel = await getChannelById(actor.workspaceId, input.channelId);
    if (!channel) return errorResponse(404, "Kanal bulunamadı");
  }

  const task = await createTask(actor.workspaceId, {
    ...input,
    createdByMemberId: actor.memberId,
  });

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "task.create",
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
    }
  );

  return okResponse(task, 201);
}
