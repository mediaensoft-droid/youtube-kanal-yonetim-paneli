import { NextRequest } from "next/server";
import { okResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { searchFiles } from "@/lib/db/files";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return okResponse([]);

  const files = await searchFiles(actor.workspaceId, q);
  return okResponse(files);
}
