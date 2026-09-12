import { NextRequest } from "next/server";
import { z } from "zod";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { getMemberPasswordHash, setMemberPasswordHash } from "@/lib/db/members";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema });

// Sets/changes the owner's profile password (asked on /profiles after the Google sign-in).
export async function POST(req: NextRequest) {
  const actor = await requirePermission("billing.view");
  if (isResponse(actor)) return actor;
  if (!actor.isOwner) return errorResponse(403, "Bu işlem için yetkiniz yok");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");

  const existing = await getMemberPasswordHash(actor.memberId);
  if (existing) {
    if (!parsed.data.currentPassword || !(await verifyPassword(parsed.data.currentPassword, existing))) {
      return errorResponse(400, "Mevcut şifre hatalı");
    }
  }
  await setMemberPasswordHash(actor.workspaceId, actor.memberId, await hashPassword(parsed.data.newPassword));
  return okResponse({ ok: true });
}
