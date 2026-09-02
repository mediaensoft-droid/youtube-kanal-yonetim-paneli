import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validation";
import { getUserById, updateUserProfile } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const user = await getUserById(userId);
  if (!user) return errorResponse(404, "Kullanıcı bulunamadı");
  return okResponse(user);
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const json = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  if (parsed.data.image === null) {
    const existing = await getUserById(userId);
    if (existing?.image?.includes(".public.blob.vercel-storage.com")) {
      del(existing.image).catch(() => {});
    }
  }

  const user = await updateUserProfile(userId, parsed.data);
  return okResponse(user);
}
