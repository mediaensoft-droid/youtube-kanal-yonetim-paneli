import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { getScheduleEntryById, deleteScheduleEntry } from "@/lib/db/schedule";
import { getChannelById } from "@/lib/db/channels";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("schedule.write");
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;

  const { id } = await params;
  const entryId = Number(id);
  const existing = await getScheduleEntryById(userId, entryId);
  if (!existing) return errorResponse(404, "Kayıt bulunamadı");

  const channel = await getChannelById(userId, existing.channelId);

  await deleteScheduleEntry(userId, entryId);

  await logActivity(
    { workspaceId: userId, memberId: actor.memberId },
    {
      action: "schedule.delete",
      entityType: "schedule",
      entityId: entryId,
      entityName: channel?.name ?? null,
      details: { date: existing.date },
    }
  );

  return new Response(null, { status: 204 });
}
