import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { taskColumnSchema } from "@/lib/validation";
import { createColumn } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requirePermission("task.write");
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = taskColumnSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const column = await createColumn(actor.workspaceId, parsed.data.name);
  return okResponse(column, 201);
}
