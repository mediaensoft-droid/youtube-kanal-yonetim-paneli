import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateTaskColumnSchema } from "@/lib/validation";
import { getColumnById, updateColumn, deleteColumn } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const columnId = Number(id);
  const existing = await getColumnById(actor.workspaceId, columnId);
  if (!existing) return errorResponse(404, "Sütun bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateTaskColumnSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const column = await updateColumn(actor.workspaceId, columnId, parsed.data);
  return okResponse(column);
}

// Column delete is not destructive to tasks — they're moved to another column — so this stays
// behind task.write (the same permission as every other board edit), not task.delete.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const columnId = Number(id);
  const existing = await getColumnById(actor.workspaceId, columnId);
  if (!existing) return errorResponse(404, "Sütun bulunamadı");

  try {
    await deleteColumn(actor.workspaceId, columnId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sütun silinemedi";
    return errorResponse(400, message);
  }

  return new Response(null, { status: 204 });
}
