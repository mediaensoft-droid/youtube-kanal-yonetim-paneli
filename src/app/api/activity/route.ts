import { NextRequest } from "next/server";
import { z } from "zod";
import { okResponse, errorResponse } from "@/lib/http";
import { requirePermission, isResponse } from "@/lib/authz";
import { ACTIVITY_TYPES } from "@/lib/activity";
import { listActivity, summarizeActivity } from "@/lib/db/activity";
import { countAssignedTasks } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

const TYPE_KEYS = Object.keys(ACTIVITY_TYPES) as [string, ...string[]];

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)")
  .refine((d) => !Number.isNaN(Date.parse(d + "T00:00:00Z")), "Geçersiz tarih");

const querySchema = z.object({
  memberId: z.coerce.number().int().positive().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  type: z.enum(TYPE_KEYS).optional(),
  cursor: z.coerce.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const actor = await requirePermission("team.manage");
  if (isResponse(actor)) return actor;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    memberId: searchParams.get("memberId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const { memberId, from, to, type, cursor } = parsed.data;
  const actions = type ? ACTIVITY_TYPES[type] : undefined;

  // A future type with no actions yet would otherwise silently return everything (an empty
  // IN (...) list matches nothing in `listActivity`, but skipping the filter entirely — the
  // `actions && actions.length > 0` guard there — is worse), so short-circuit defensively.
  if (type && actions && actions.length === 0) {
    return okResponse({ items: [], summary: cursor === undefined ? {} : null, nextCursor: null });
  }

  const [{ items, nextCursor }, summary, assignedTasks] = await Promise.all([
    listActivity(actor.workspaceId, { memberId, from, to, actions, cursor, limit: 50 }),
    cursor === undefined ? summarizeActivity(actor.workspaceId, { from, to, memberId }) : Promise.resolve(null),
    cursor === undefined ? countAssignedTasks(actor.workspaceId, { from, to }) : Promise.resolve(null),
  ]);

  // Assigned-task counts aren't an activity_log action (they come straight from `tasks`), so they
  // ride along on the same per-member summary under a synthetic "task.assigned" key.
  if (summary && assignedTasks) {
    for (const [memberIdKey, count] of Object.entries(assignedTasks)) {
      const id = Number(memberIdKey);
      if (memberId !== undefined && id !== memberId) continue;
      if (!summary[id]) summary[id] = {};
      summary[id]["task.assigned"] = count;
    }
  }

  return okResponse({ items, summary, nextCursor });
}
