import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { changeOwnPasswordSchema } from "@/lib/validation";
import { getMemberPasswordHash, setMemberPasswordHash } from "@/lib/db/members";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  if (actor.role === "yonetici") {
    return errorResponse(400, "Yönetici için profil sayfasını kullanın");
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
  return new Response(null, { status: 204 });
}
