import "server-only";
import { all, run } from "@/lib/db";
import type { ActivityAction } from "@/lib/activity";
import type { ActivityItem, ActivityEntityType } from "@/types";

export interface LogActivityActor {
  workspaceId: number;
  memberId: number;
}

export interface LogActivityEntry {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: number | null;
  entityName?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Fire-and-record audit log write. Never throws — a logging failure must never break the write
 * it's describing, so any DB error here is swallowed (and reported) rather than propagated.
 */
export async function logActivity(actor: LogActivityActor, entry: LogActivityEntry): Promise<void> {
  try {
    await run(
      `INSERT INTO activity_log (userId, memberId, action, entityType, entityId, entityName, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.workspaceId,
        actor.memberId,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.entityName ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
      ]
    );
  } catch (err) {
    console.error("logActivity failed", err);
  }
}

interface ActivityRow {
  id: number;
  memberId: number | null;
  memberName: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  entityName: string | null;
  details: string | null;
  createdAt: string;
}

function rowToItem(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: row.memberName,
    action: row.action as ActivityAction,
    entityType: row.entityType as ActivityEntityType,
    entityId: row.entityId,
    entityName: row.entityName,
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : {},
    createdAt: row.createdAt,
  };
}

/** `to` is inclusive as a calendar day: results include everything up to and including that date. */
function exclusiveUpperBound(toDate: string): string {
  const d = new Date(`${toDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface ListActivityOptions {
  memberId?: number;
  from?: string;
  to?: string;
  actions?: ActivityAction[];
  cursor?: number;
  limit?: number;
}

export interface ListActivityResult {
  items: ActivityItem[];
  nextCursor: number | null;
}

export async function listActivity(userId: number, options: ListActivityOptions = {}): Promise<ListActivityResult> {
  const limit = options.limit ?? 50;
  const conditions: string[] = [`a.userId = ?`];
  const params: (string | number)[] = [userId];

  if (options.memberId !== undefined) {
    conditions.push(`a.memberId = ?`);
    params.push(options.memberId);
  }
  if (options.from) {
    conditions.push(`a.createdAt >= ?`);
    params.push(options.from);
  }
  if (options.to) {
    conditions.push(`a.createdAt < ?`);
    params.push(exclusiveUpperBound(options.to));
  }
  if (options.actions && options.actions.length > 0) {
    conditions.push(`a.action IN (${options.actions.map(() => "?").join(", ")})`);
    params.push(...options.actions);
  }
  if (options.cursor !== undefined) {
    conditions.push(`a.id < ?`);
    params.push(options.cursor);
  }

  // Fetch one extra row to know whether there's a next page without a separate COUNT query.
  const rows = await all<ActivityRow>(
    `SELECT a.id, a.memberId, m.displayName AS memberName, a.action, a.entityType, a.entityId, a.entityName, a.details, a.createdAt
       FROM activity_log a
       LEFT JOIN members m ON m.id = a.memberId
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.id DESC
      LIMIT ?`,
    [...params, limit + 1]
  );

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(rowToItem);
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}

export interface SummarizeActivityOptions {
  from?: string;
  to?: string;
  memberId?: number;
}

/** memberId -> action -> count, for the /team/activity per-person summary cards. */
export async function summarizeActivity(
  userId: number,
  options: SummarizeActivityOptions = {}
): Promise<Record<number, Record<string, number>>> {
  const conditions: string[] = [`userId = ?`];
  const params: (string | number)[] = [userId];

  if (options.from) {
    conditions.push(`createdAt >= ?`);
    params.push(options.from);
  }
  if (options.to) {
    conditions.push(`createdAt < ?`);
    params.push(exclusiveUpperBound(options.to));
  }
  if (options.memberId !== undefined) {
    conditions.push(`memberId = ?`);
    params.push(options.memberId);
  }

  const rows = await all<{ memberId: number | null; action: string; count: number }>(
    `SELECT memberId, action, COUNT(*) as count
       FROM activity_log
      WHERE ${conditions.join(" AND ")}
      GROUP BY memberId, action`,
    params
  );

  const result: Record<number, Record<string, number>> = {};
  for (const row of rows) {
    if (row.memberId === null) continue;
    if (!result[row.memberId]) result[row.memberId] = {};
    result[row.memberId][row.action] = row.count;
  }
  return result;
}
