import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { okResponse, errorResponse } from "@/lib/http";
import { getSessionUserId } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/db/users";

export const dynamic = "force-dynamic";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return errorResponse(400, "Dosya bulunamadı");

  if (!ALLOWED_TYPES.includes(file.type)) {
    return errorResponse(400, "Yalnızca PNG, JPEG, WEBP veya GIF yükleyebilirsiniz");
  }
  if (file.size > MAX_SIZE) {
    return errorResponse(400, "Dosya 4MB'tan küçük olmalı");
  }

  const existing = await getUserById(userId);
  const extension = file.type.split("/")[1] ?? "png";

  let blobUrl: string;
  try {
    const blob = await put(`avatars/user-${userId}-${Date.now()}.${extension}`, file, {
      access: "public",
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return errorResponse(
      503,
      "Fotoğraf depolama henüz kurulmadı. Lütfen Vercel Blob entegrasyonunu ekleyin."
    );
  }

  // Best-effort cleanup of the previous avatar, only if it was one of ours (not a Google photo URL).
  if (existing?.image?.includes(".public.blob.vercel-storage.com")) {
    del(existing.image).catch(() => {});
  }

  const user = await updateUserProfile(userId, { image: blobUrl });
  return okResponse(user);
}
