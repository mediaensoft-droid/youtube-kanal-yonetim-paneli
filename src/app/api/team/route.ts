import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { createMemberSchema } from "@/lib/validation";
import { listMembers, createMember, isUsernameTaken } from "@/lib/db/members";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requirePermission("team.manage");
  if (isResponse(actor)) return actor;

  return okResponse(await listMembers(actor.workspaceId));
}

export async function POST(req: NextRequest) {
  const actor = await requirePermission("team.manage");
  if (isResponse(actor)) return actor;

  const json = await req.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }

  const { displayName, username, password, role } = parsed.data;
  if (await isUsernameTaken(username)) {
    return errorResponse(409, "Bu kullanıcı adı kullanımda");
  }

  const member = await createMember(actor.workspaceId, {
    displayName,
    username,
    role,
    passwordHash: await hashPassword(password),
  });
  return okResponse(member, 201);
}
