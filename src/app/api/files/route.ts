import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, requirePermission, isResponse } from "@/lib/authz";
import { listFolderContents, getFolderById, createFile } from "@/lib/db/files";
import { validateUpload, putUpload, deleteUpload } from "@/lib/uploads";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

/** `null` (no/blank param) means the workspace root; `undefined` means the param was junk. */
function parseFolderId(raw: string | null): number | null | undefined {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export async function GET(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const folderId = parseFolderId(req.nextUrl.searchParams.get("folderId"));
  if (folderId === undefined) return errorResponse(400, "Geçersiz istek");

  if (folderId !== null) {
    const folder = await getFolderById(actor.workspaceId, folderId);
    if (!folder) return errorResponse(404, "Klasör bulunamadı");
  }

  const contents = await listFolderContents(actor.workspaceId, folderId);
  return okResponse(contents);
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission("files.write");
  if (isResponse(actor)) return actor;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return errorResponse(400, "Dosya bulunamadı");

  const validated = validateUpload(file);
  if (!validated.ok) return errorResponse(400, validated.error);

  const folderIdRaw = formData?.get("folderId");
  let folderId: number | null = null;
  if (typeof folderIdRaw === "string" && folderIdRaw.trim() !== "") {
    const n = Number(folderIdRaw);
    if (!Number.isInteger(n) || n <= 0) return errorResponse(400, "Geçersiz klasör");
    const folder = await getFolderById(actor.workspaceId, n);
    if (!folder) return errorResponse(404, "Klasör bulunamadı");
    folderId = n;
  }

  const descriptionRaw = formData?.get("description");
  const description =
    typeof descriptionRaw === "string" && descriptionRaw.trim() !== "" ? descriptionRaw.trim().slice(0, 500) : null;

  let uploaded;
  try {
    uploaded = await putUpload(`docs/ws-${actor.workspaceId}`, file);
  } catch {
    return errorResponse(503, "Dosya depolama şu anda kullanılamıyor. Lütfen Vercel Blob entegrasyonunu ekleyin.");
  }

  try {
    const docFile = await createFile(actor.workspaceId, actor.memberId, {
      folderId,
      name: file.name,
      blobUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      description,
    });

    await logActivity(
      { workspaceId: actor.workspaceId, memberId: actor.memberId },
      { action: "file.upload", entityType: "file", entityId: docFile.id, entityName: docFile.name }
    );

    return okResponse(docFile, 201);
  } catch (err) {
    // The DB row never landed — don't leave an orphaned blob behind.
    await deleteUpload(uploaded.url);
    const message = err instanceof Error ? err.message : "Dosya kaydedilemedi";
    return errorResponse(400, message);
  }
}
