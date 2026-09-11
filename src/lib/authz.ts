import "server-only";
import { redirect } from "next/navigation";
import { errorResponse } from "@/lib/http";
import { getSessionActor, type Actor } from "@/lib/auth";
import { can, type Permission } from "@/lib/roles";

export async function requireActor(): Promise<Actor | Response> {
  const actor = await getSessionActor();
  return actor ?? errorResponse(401, "Unauthorized");
}

/** API guard: 401 when logged out, 403 when the role lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Actor | Response> {
  const actor = await getSessionActor();
  if (!actor) return errorResponse(401, "Unauthorized");
  if (!can(actor.role, permission)) return errorResponse(403, "Bu işlem için yetkiniz yok");
  return actor;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

/** Page guard for server components: bounce to /sign-in when logged out, to / when not allowed. */
export async function requirePageRole(permission: Permission): Promise<Actor> {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");
  if (!can(actor.role, permission)) redirect("/");
  return actor;
}
