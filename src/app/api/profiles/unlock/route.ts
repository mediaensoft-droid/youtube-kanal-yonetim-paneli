import { NextRequest } from "next/server";
import { z } from "zod";
import { okResponse, errorResponse } from "@/lib/http";
import { auth, unstable_update } from "@/lib/auth";
import { getMemberPasswordHash } from "@/lib/db/members";
import { verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({ password: z.string().min(1) });

// Owner profile password check for the /profiles picker. Only an owner session can call it;
// success flips `ownerUnlocked` on the JWT so getSessionUserId()/getSessionActor() start working.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.member?.isOwner) return errorResponse(401, "Unauthorized");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "Şifre gerekli");

  const hash = await getMemberPasswordHash(session.member.id);
  if (hash && !(await verifyPassword(parsed.data.password, hash))) {
    return errorResponse(400, "Şifre hatalı");
  }

  await unstable_update({ ownerUnlocked: true } as never);
  return okResponse({ ok: true });
}
