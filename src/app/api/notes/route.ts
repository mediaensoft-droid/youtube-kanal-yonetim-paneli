import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { createNoteSchema } from "@/lib/validation";
import { listNotes, createNote } from "@/lib/db/notes";
import { getMemberById } from "@/lib/db/members";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const memberIdParam = req.nextUrl.searchParams.get("memberId");
  let targetMemberId = actor.memberId;

  if (memberIdParam !== null) {
    const requestedId = Number(memberIdParam);
    if (!Number.isInteger(requestedId)) return errorResponse(400, "Geçersiz istek");
    // Only the owner may look at someone else's notes, only for staff in their own workspace,
    // and never for another owner row — nobody reads the owner's own notes but the owner.
    if (actor.role !== "yonetici") return errorResponse(403, "Bu işlem için yetkiniz yok");
    const target = await getMemberById(requestedId);
    if (!target || target.userId !== actor.workspaceId) return errorResponse(403, "Bu işlem için yetkiniz yok");
    if (target.role === "yonetici") return errorResponse(403, "Bu işlem için yetkiniz yok");
    targetMemberId = requestedId;
  }

  const notes = await listNotes(actor.workspaceId, targetMemberId);
  return okResponse(notes);
}

export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = createNoteSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  // Always created for the actor themselves — there is no way to create a note for someone else.
  const note = await createNote(actor.workspaceId, actor.memberId, parsed.data);
  return okResponse(note, 201);
}
