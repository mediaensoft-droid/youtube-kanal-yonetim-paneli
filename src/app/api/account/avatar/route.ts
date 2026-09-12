import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { getMemberById, setMemberImage } from "@/lib/db/members";

export const dynamic = "force-dynamic";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function isOurBlob(url: string | null): url is string {
  return Boolean(url && url.includes(".public.blob.vercel-storage.com"));
}

// Staff profile photo (the owner's lives on /api/profile/avatar). Only ever touches the actor's own row.
export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (actor.isOwner) return errorResponse(400, "Hesap sahibi için profil sayfasını kullanın");

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return errorResponse(400, "Dosya bulunamadı");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return errorResponse(400, "Yalnızca PNG, JPEG, WEBP veya GIF yükleyebilirsiniz");
  }
  if (file.size > MAX_SIZE) return errorResponse(400, "Dosya 4MB'tan küçük olmalı");

  const existing = await getMemberById(actor.memberId);
  const extension = file.type.split("/")[1] ?? "png";
  let blobUrl: string;
  try {
    const blob = await put(`avatars/member-${actor.memberId}-${Date.now()}.${extension}`, file, {
      access: "public",
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch {
    return errorResponse(503, "Fotoğraf depolama şu anda kullanılamıyor.");
  }

  if (isOurBlob(existing?.image ?? null)) del(existing!.image!).catch(() => {});
  await setMemberImage(actor.workspaceId, actor.memberId, blobUrl);
  return okResponse({ image: blobUrl });
}

export async function DELETE() {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (actor.isOwner) return errorResponse(400, "Hesap sahibi için profil sayfasını kullanın");

  const existing = await getMemberById(actor.memberId);
  if (isOurBlob(existing?.image ?? null)) del(existing!.image!).catch(() => {});
  await setMemberImage(actor.workspaceId, actor.memberId, null);
  return okResponse({ image: null });
}
