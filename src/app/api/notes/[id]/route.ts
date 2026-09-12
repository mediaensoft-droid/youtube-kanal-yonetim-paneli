import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { updateNoteSchema } from "@/lib/validation";
import { getNoteById, updateNote, deleteNote } from "@/lib/db/notes";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const noteId = Number(id);
  const existing = await getNoteById(actor.workspaceId, noteId);
  if (!existing) return errorResponse(404, "Not bulunamadı");
  // The owner can read staff notes but never edit them, and nobody edits another member's notes.
  if (existing.memberId !== actor.memberId) return errorResponse(403, "Bu işlem için yetkiniz yok");

  const json = await req.json().catch(() => null);
  const parsed = updateNoteSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const note = await updateNote(actor.workspaceId, noteId, parsed.data);
  return okResponse(note);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const noteId = Number(id);
  const existing = await getNoteById(actor.workspaceId, noteId);
  if (!existing) return errorResponse(404, "Not bulunamadı");
  if (existing.memberId !== actor.memberId) return errorResponse(403, "Bu işlem için yetkiniz yok");

  await deleteNote(actor.workspaceId, noteId);
  return new Response(null, { status: 204 });
}
