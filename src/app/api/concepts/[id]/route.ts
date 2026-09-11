import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateConceptSchema } from "@/lib/validation";
import { getConceptById, updateConcept, deleteConcept } from "@/lib/db/concepts";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("taxonomy.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const { id } = await params;
  const conceptId = Number(id);
  const existing = await getConceptById(userId, conceptId);
  if (!existing) return errorResponse(404, "Konsept bulunamadı");

  const json = await req.json().catch(() => null);
  const parsed = updateConceptSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const concept = await updateConcept(userId, conceptId, parsed.data);
    return okResponse(concept);
  } catch {
    return errorResponse(409, "Bu isimde bir konsept zaten var.");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("taxonomy.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const { id } = await params;
  const conceptId = Number(id);
  const existing = await getConceptById(userId, conceptId);
  if (!existing) return errorResponse(404, "Konsept bulunamadı");

  await deleteConcept(userId, conceptId);
  return new Response(null, { status: 204 });
}
