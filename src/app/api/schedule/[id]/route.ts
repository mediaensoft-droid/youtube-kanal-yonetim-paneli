import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { getScheduleEntryById, deleteScheduleEntry } from "@/lib/db/schedule";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const { id } = await params;
  const entryId = Number(id);
  const existing = await getScheduleEntryById(userId, entryId);
  if (!existing) return errorResponse(404, "Kayıt bulunamadı");

  await deleteScheduleEntry(userId, entryId);
  return new Response(null, { status: 204 });
}
