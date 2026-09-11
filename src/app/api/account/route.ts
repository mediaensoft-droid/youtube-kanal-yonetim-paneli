import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requireActor, isResponse } from "@/lib/authz";
import { updateAccountSchema } from "@/lib/validation";
import { updateMember } from "@/lib/db/members";
import { logActivity } from "@/lib/db/activity";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;

  if (actor.role === "yonetici") {
    return errorResponse(400, "Yönetici için profil sayfasını kullanın");
  }

  const json = await req.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const member = await updateMember(actor.workspaceId, actor.memberId, { displayName: parsed.data.displayName });

  await logActivity(
    { workspaceId: actor.workspaceId, memberId: actor.memberId },
    {
      action: "account.update",
      entityType: "member",
      entityId: member.id,
      entityName: member.displayName,
    }
  );

  return okResponse(member);
}
