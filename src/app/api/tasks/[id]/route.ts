import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateTaskSchema } from "@/lib/validation";
import { getTaskById, updateTask, deleteTask } from "@/lib/db/tasks";
import { getMemberById } from "@/lib/db/members";
import { getChannelById } from "@/lib/db/channels";
import { logActivity } from "@/lib/db/activity";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CHANGED_FIELD_KEYS = [
  "title",
  "description",
  "assigneeMemberId",
  "channelId",
  "dueDate",
  "priority",
  "checklist",
] as const satisfies readonly (keyof Task)[];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const taskId = Number(id);
  const existing = await getTaskById(actor.workspaceId, taskId);
  if (!existing) return errorResponse(404, "Görev bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const patch = parsed.data;

  if (patch.assigneeMemberId !== null && patch.assigneeMemberId !== undefined) {
    const member = await getMemberById(patch.assigneeMemberId);
    if (!member || member.userId !== actor.workspaceId) {
      return errorResponse(404, "Üye bulunamadı");
    }
  }
  if (patch.channelId !== null && patch.channelId !== undefined) {
    const channel = await getChannelById(actor.workspaceId, patch.channelId);
    if (!channel) return errorResponse(404, "Kanal bulunamadı");
  }

  const task = await updateTask(actor.workspaceId, taskId, patch);

  const changedFields = CHANGED_FIELD_KEYS.filter((key) => {
    if (patch[key] === undefined) return false;
    return JSON.stringify(existing[key]) !== JSON.stringify(patch[key]);
  });

  if (changedFields.length > 0) {
    await logActivity(
      { workspaceId: actor.workspaceId, memberId: actor.memberId },
      {
        action: "task.update",
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        details: { changedFields },
      }
    );
  }

  return okResponse(task);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.delete");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const taskId = Number(id);
  const existing = await getTaskById(actor.workspaceId, taskId);
  if (!existing) return errorResponse(404, "Görev bulunamadı");

  await deleteTask(actor.workspaceId, taskId);

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "task.delete",
      entityType: "task",
      entityId: taskId,
      entityName: existing.title,
    }
  );

  return new Response(null, { status: 204 });
}
