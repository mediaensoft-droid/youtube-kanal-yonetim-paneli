import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { setMemberPasswordSchema } from "@/lib/validation";
import { getMemberById, setMemberPasswordHash } from "@/lib/db/members";
import { hashPassword } from "@/lib/password";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const actor = await requirePermission("team.manage");
  if (isResponse(actor)) return actor;

  const { id } = await params;
  const memberId = Number(id);
  const existing = await getMemberById(memberId);
  if (!existing || existing.userId !== actor.workspaceId) {
    return errorResponse(404, "Üye bulunamadı");
  }
  if (existing.username === null) {
    return errorResponse(400, "Hesap sahibi düzenlenemez");
  }

  const json = await req.json().catch(() => null);
  const parsed = setMemberPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  await setMemberPasswordHash(actor.workspaceId, memberId, await hashPassword(parsed.data.password));

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "member.password",
      entityType: "member",
      entityId: memberId,
      entityName: existing.displayName,
    }
  );

  return new Response(null, { status: 204 });
}
