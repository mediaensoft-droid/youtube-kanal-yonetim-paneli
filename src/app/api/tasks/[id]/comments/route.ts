import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, requirePermission, isResponse } from "@/lib/authz";
import { taskCommentSchema } from "@/lib/validation";
import { getTaskById, listComments, addComment } from "@/lib/db/tasks";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const taskId = Number(id);
  const task = await getTaskById(actor.workspaceId, taskId);
  if (!task) return errorResponse(404, "Görev bulunamadı");

  const comments = await listComments(actor.workspaceId, taskId);
  return okResponse(comments);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const taskId = Number(id);
  const task = await getTaskById(actor.workspaceId, taskId);
  if (!task) return errorResponse(404, "Görev bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = taskCommentSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const comment = await addComment(actor.workspaceId, taskId, actor.memberId, parsed.data.body);

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "task.comment",
      entityType: "task",
      entityId: taskId,
      entityName: task.title,
    }
  );

  return okResponse(comment, 201);
}
