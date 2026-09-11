import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { moveTaskSchema } from "@/lib/validation";
import { getTaskById, getColumnById, moveTask } from "@/lib/db/tasks";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const taskId = Number(id);
  const existing = await getTaskById(actor.workspaceId, taskId);
  if (!existing) return errorResponse(404, "Görev bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = moveTaskSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const targetColumn = await getColumnById(actor.workspaceId, parsed.data.columnId);
  if (!targetColumn) return errorResponse(404, "Sütun bulunamadı");

  const { task, fromColumn, toColumn } = await moveTask(
    actor.workspaceId,
    taskId,
    parsed.data.columnId,
    parsed.data.position
  );

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "task.move",
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
      details: { from: fromColumn.name, to: toColumn.name },
    }
  );

  if (toColumn.isDone && !fromColumn.isDone) {
    await logActivity(
      { workspaceId: actor.workspaceId, memberId: actor.memberId },
      {
        action: "task.complete",
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
      }
    );
  }

  return okResponse(task);
}
