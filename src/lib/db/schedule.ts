import "server-only";
import { all, get, run } from "@/lib/db";
import type { ChannelPublishCount, ScheduleEntry, ScheduleStatus, UpsertScheduleEntryInput } from "@/types";

interface ScheduleEntryRow {
  id: number;
  channelId: number;
  date: string;
  title: string | null;
  status: ScheduleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToEntry(row: ScheduleEntryRow): ScheduleEntry {
  return {
    id: row.id,
    channelId: row.channelId,
    date: row.date,
    title: row.title,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listScheduleEntries(
  userId: number,
  start: string,
  end: string
): Promise<ScheduleEntry[]> {
  const rows = await all<ScheduleEntryRow>(
    `SELECT id, channelId, date, title, status, notes, createdAt, updatedAt
     FROM schedule_entries
     WHERE userId = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [userId, start, end]
  );
  return rows.map(rowToEntry);
}

export async function getScheduleEntryById(
  userId: number,
  id: number
): Promise<ScheduleEntry | undefined> {
  const row = await get<ScheduleEntryRow>(
    `SELECT id, channelId, date, title, status, notes, createdAt, updatedAt
     FROM schedule_entries WHERE id = ? AND userId = ?`,
    [id, userId]
  );
  return row ? rowToEntry(row) : undefined;
}

export async function upsertScheduleEntry(
  userId: number,
  input: UpsertScheduleEntryInput
): Promise<ScheduleEntry> {
  const existingRow = await get<ScheduleEntryRow>(
    `SELECT id, channelId, date, title, status, notes, createdAt, updatedAt
     FROM schedule_entries WHERE userId = ? AND channelId = ? AND date = ?`,
    [userId, input.channelId, input.date]
  );

  const status = input.status ?? existingRow?.status ?? "planned";
  const title = input.title !== undefined ? input.title : (existingRow?.title ?? null);
  const notes = input.notes !== undefined ? input.notes : (existingRow?.notes ?? null);

  if (existingRow) {
    await run(
      `UPDATE schedule_entries
         SET status = ?, title = ?, notes = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND userId = ?`,
      [status, title, notes, existingRow.id, userId]
    );
    return (await getScheduleEntryById(userId, existingRow.id))!;
  }

  const result = await run(
    `INSERT INTO schedule_entries (userId, channelId, date, status, title, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, input.channelId, input.date, status, title, notes]
  );
  return (await getScheduleEntryById(userId, result.lastInsertRowid))!;
}

export async function deleteScheduleEntry(userId: number, id: number): Promise<void> {
  await run(`DELETE FROM schedule_entries WHERE id = ? AND userId = ?`, [id, userId]);
}

export async function countPublishedByChannel(
  userId: number,
  start?: string,
  end?: string
): Promise<ChannelPublishCount[]> {
  const conditions = ["userId = ?", "status = 'published'"];
  const args: (string | number)[] = [userId];
  if (start) {
    conditions.push("date >= ?");
    args.push(start);
  }
  if (end) {
    conditions.push("date <= ?");
    args.push(end);
  }

  const rows = await all<{ channelId: number; count: number }>(
    `SELECT channelId, COUNT(*) as count FROM schedule_entries WHERE ${conditions.join(" AND ")} GROUP BY channelId`,
    args
  );
  return rows.map((r) => ({ channelId: r.channelId, count: Number(r.count) }));
}
