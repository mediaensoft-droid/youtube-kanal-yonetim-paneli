import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { updateMemberSchema } from "@/lib/validation";
import { getMemberById, updateMember } from "@/lib/db/members";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("team.manage");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const memberId = Number(id);
  const existing = await getMemberById(memberId);
  if (!existing || existing.userId !== actor.workspaceId) {
    return errorResponse(404, "Üye bulunamadı");
  }
  if (existing.role === "yonetici") {
    return errorResponse(400, "Yönetici hesabı düzenlenemez");
  }

  const json = await req.json().catch(() => null);
  const parsed = updateMemberSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const member = await updateMember(actor.workspaceId, memberId, parsed.data);

  const statusChanged = parsed.data.status !== undefined && parsed.data.status !== existing.status;
  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    statusChanged
      ? {
          action: "member.status",
          entityType: "member",
          entityId: member.id,
          entityName: member.displayName,
          details: { from: existing.status, to: parsed.data.status },
        }
      : {
          action: "member.update",
          entityType: "member",
          entityId: member.id,
          entityName: member.displayName,
        }
  );

  return okResponse(member);
}
