import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { changeOwnPasswordSchema } from "@/lib/validation";
import { getMemberPasswordHash, setMemberPasswordHash } from "@/lib/db/members";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  if (actor.isOwner) {
    return errorResponse(400, "Hesap sahibi için profil sayfasını kullanın");
  }

  const json = await req.json().catch(() => null);
  const parsed = changeOwnPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const hash = await getMemberPasswordHash(actor.memberId);
  if (!hash || !(await verifyPassword(parsed.data.currentPassword, hash))) {
    return errorResponse(400, "Mevcut şifre hatalı");
  }

  await setMemberPasswordHash(actor.workspaceId, actor.memberId, await hashPassword(parsed.data.newPassword));

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    { action: "account.password", entityType: "member", entityId: actor.memberId }
  );

  return new Response(null, { status: 204 });
}
