import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { createMessageSchema } from "@/lib/validation";
import { validateUpload, putUpload, deleteUpload } from "@/lib/uploads";
import { getConversationById, isParticipant, listMessages, createMessage } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

/** Loads the conversation and checks the caller is one of its participants — shared by GET/POST. */
async function loadParticipantConversation(workspaceId: number, memberId: number, rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { error: errorResponse(400, "Geçersiz istek") } as const;
  const conversation = await getConversationById(workspaceId, id);
  if (!conversation) return { error: errorResponse(404, "Sohbet bulunamadı") } as const;
  if (!isParticipant(conversation, memberId)) {
    return { error: errorResponse(403, "Bu işlem için yetkiniz yok") } as const;
  }
  return { conversation } as const;
}

function parseOptionalMessageId(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { conversationId } = await params;
  const { conversation, error } = await loadParticipantConversation(actor.workspaceId, actor.memberId, conversationId);
  if (error) return error;

  const after = parseOptionalMessageId(req.nextUrl.searchParams.get("after"));
  const before = parseOptionalMessageId(req.nextUrl.searchParams.get("before"));

  const messages = await listMessages(actor.workspaceId, conversation.id, { after, before });
  return okResponse(messages);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  const { conversationId } = await params;
  const { conversation, error } = await loadParticipantConversation(actor.workspaceId, actor.memberId, conversationId);
  if (error) return error;

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (!isMultipart) {
    const json = await req.json().catch(() => null);
    const parsed = createMessageSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
    }
    const message = await createMessage(actor.workspaceId, conversation.id, actor.memberId, { body: parsed.data.body });
    return okResponse(message, 201);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const bodyRaw = formData?.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";

  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !body) {
    return errorResponse(400, "Mesaj veya dosya gerekli");
  }
  if (body.length > 4000) {
    return errorResponse(400, "Mesaj çok uzun");
  }

  let uploaded: { url: string; pathname: string } | null = null;
  if (hasFile) {
    const validated = validateUpload(file as File);
    if (!validated.ok) return errorResponse(400, validated.error);
    try {
      uploaded = await putUpload(`chat/ws-${actor.workspaceId}`, file as File);
    } catch {
      return errorResponse(503, "Dosya depolama şu anda kullanılamıyor. Lütfen Vercel Blob entegrasyonunu ekleyin.");
    }
  }

  try {
    const message = await createMessage(actor.workspaceId, conversation.id, actor.memberId, {
      body,
      attachment: uploaded
        ? {
            url: uploaded.url,
            name: (file as File).name,
            size: (file as File).size,
            type: (file as File).type || "application/octet-stream",
          }
        : undefined,
    });
    return okResponse(message, 201);
  } catch (err) {
    if (uploaded) await deleteUpload(uploaded.url);
    return errorResponse(400, err instanceof Error ? err.message : "Mesaj gönderilemedi");
  }
}
