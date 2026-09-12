import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateFolderSchema } from "@/lib/validation";
import { getFolderById, updateFolder, deleteFolder } from "@/lib/db/files";
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
  const folderId = Number(id);
  const existing = await getFolderById(actor.workspaceId, folderId);
  if (!existing) return errorResponse(404, "Klasör bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateFolderSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  let folder;
  try {
    folder = await updateFolder(actor.workspaceId, folderId, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Klasör güncellenemedi";
    // A missing/foreign target parentId reads as "not found", consistent with the POST route.
    return errorResponse(message === "Hedef klasör bulunamadı" ? 404 : 400, message);
  }

  return okResponse(folder);
}

// Delete removes the folder AND everything inside it (subfolders + files, blobs included) —
// gated behind files.delete, not files.write, because it's destructive.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("files.delete");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const folderId = Number(id);
  const existing = await getFolderById(actor.workspaceId, folderId);
  if (!existing) return errorResponse(404, "Klasör bulunamadı");

  const blobUrls = await deleteFolder(actor.workspaceId, folderId);
  await Promise.all(blobUrls.map((url) => deleteUpload(url)));

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    { action: "folder.delete", entityType: "folder", entityId: folderId, entityName: existing.name }
  );

  return new Response(null, { status: 204 });
}
