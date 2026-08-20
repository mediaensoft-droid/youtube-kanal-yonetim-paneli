import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { createConceptSchema } from "@/lib/validation";
import { listConcepts, createConcept } from "@/lib/db/concepts";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
  return okResponse(await listConcepts(userId));
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const json = await req.json().catch(() => null);
  const parsed = createConceptSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  try {
    const concept = await createConcept(userId, parsed.data);
    return okResponse(concept, 201);
  } catch {
    return errorResponse(409, "Bu isimde bir konsept zaten var.");
  }
}
