import "server-only";
import { all, get, run } from "@/lib/db";
import type { ScheduleEntry, ScheduleStatus, UpsertScheduleEntryInput } from "@/types";

interface ScheduleEntryRow {
  id: number;
  channelId: number;
  date: string;
  title: string | null;
  status: ScheduleStatus;
  notes: string | null;
  publishedAt: string | null;
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
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const SELECT_COLUMNS = "id, channelId, date, title, status, notes, publishedAt, createdAt, updatedAt";

export async function listScheduleEntries(
  userId: number,
  start: string,
  end: string
): Promise<ScheduleEntry[]> {
  const rows = await all<ScheduleEntryRow>(
    `SELECT ${SELECT_COLUMNS}
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
    `SELECT ${SELECT_COLUMNS} FROM schedule_entries WHERE id = ? AND userId = ?`,
    [id, userId]
  );
  return row ? rowToEntry(row) : undefined;
}

export async function upsertScheduleEntry(
  userId: number,
  input: UpsertScheduleEntryInput
): Promise<ScheduleEntry> {
  const existingRow = await get<ScheduleEntryRow>(
    `SELECT ${SELECT_COLUMNS} FROM schedule_entries WHERE userId = ? AND channelId = ? AND date = ?`,
    [userId, input.channelId, input.date]
  );

  const status = input.status ?? existingRow?.status ?? "planned";
  const title = input.title !== undefined ? input.title : (existingRow?.title ?? null);
  const notes = input.notes !== undefined ? input.notes : (existingRow?.notes ?? null);

  // publishedAt is the real wall-clock moment the status became "published" — it starts the
  // "X önce yayınlandı" tooltip timer. It's set once on that transition, kept while the entry
  // stays published (further title/notes edits don't reset it), and cleared if the status moves
  // away from "published" so the tooltip doesn't show a stale time for a video that isn't live.
  let publishedAt = existingRow?.publishedAt ?? null;
  if (status === "published" && existingRow?.status !== "published") {
    publishedAt = new Date().toISOString();
  } else if (status !== "published") {
    publishedAt = null;
  }

  if (existingRow) {
    await run(
      `UPDATE schedule_entries
         SET status = ?, title = ?, notes = ?, publishedAt = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND userId = ?`,
      [status, title, notes, publishedAt, existingRow.id, userId]
    );
    return (await getScheduleEntryById(userId, existingRow.id))!;
  }

  const result = await run(
    `INSERT INTO schedule_entries (userId, channelId, date, status, title, notes, publishedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, input.channelId, input.date, status, title, notes, publishedAt]
  );
  return (await getScheduleEntryById(userId, result.lastInsertRowid))!;
}

export async function deleteScheduleEntry(userId: number, id: number): Promise<void> {
  await run(`DELETE FROM schedule_entries WHERE id = ? AND userId = ?`, [id, userId]);
}
