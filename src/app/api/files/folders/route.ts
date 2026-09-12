import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { createFolderSchema } from "@/lib/validation";
import { createFolder } from "@/lib/db/files";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requirePermission("files.write");
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = createFolderSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  let folder;
  try {
    folder = await createFolder(actor.workspaceId, actor.memberId, parsed.data);
  } catch (err) {
    return errorResponse(404, err instanceof Error ? err.message : "Klasör oluşturulamadı");
  }

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    { action: "folder.create", entityType: "folder", entityId: folder.id, entityName: folder.name }
  );

  return okResponse(folder, 201);
}
