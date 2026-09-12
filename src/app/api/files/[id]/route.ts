import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateFileSchema } from "@/lib/validation";
import { getFileById, updateFile, deleteFile } from "@/lib/db/files";
import { deleteUpload } from "@/lib/uploads";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("files.write");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const fileId = Number(id);
  const existing = await getFileById(actor.workspaceId, fileId);
  if (!existing) return errorResponse(404, "Dosya bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateFileSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  let file;
  try {
    file = await updateFile(actor.workspaceId, fileId, parsed.data);
  } catch (err) {
    return errorResponse(400, err instanceof Error ? err.message : "Dosya güncellenemedi");
  }

  return okResponse(file);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("files.delete");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const fileId = Number(id);
  const existing = await getFileById(actor.workspaceId, fileId);
  if (!existing) return errorResponse(404, "Dosya bulunamadı");

  const blobUrl = await deleteFile(actor.workspaceId, fileId);
  await deleteUpload(blobUrl);

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    { action: "file.delete", entityType: "file", entityId: fileId, entityName: existing.name }
  );

  return new Response(null, { status: 204 });
}
