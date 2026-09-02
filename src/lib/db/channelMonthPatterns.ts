import "server-only";
import { all, get, run } from "@/lib/db";
import type { ChannelMonthPattern } from "@/types";

interface ChannelMonthPatternRow {
  id: number;
  channelId: number;
  yearMonth: string;
  publishDays: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPattern(row: ChannelMonthPatternRow): ChannelMonthPattern {
  return {
    id: row.id,
    channelId: row.channelId,
    yearMonth: row.yearMonth,
    publishDays: JSON.parse(row.publishDays) as number[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listChannelMonthPatterns(
  userId: number,
  start: string,
  end: string
): Promise<ChannelMonthPattern[]> {
  const rows = await all<ChannelMonthPatternRow>(
    `SELECT id, channelId, yearMonth, publishDays, createdAt, updatedAt
     FROM channel_month_patterns
     WHERE userId = ? AND yearMonth >= ? AND yearMonth <= ?`,
    [userId, start, end]
  );
  return rows.map(rowToPattern);
}

export async function upsertChannelMonthPattern(
  userId: number,
  channelId: number,
  yearMonth: string,
  publishDays: number[]
): Promise<ChannelMonthPattern> {
  const existing = await get<ChannelMonthPatternRow>(
    `SELECT id, channelId, yearMonth, publishDays, createdAt, updatedAt
     FROM channel_month_patterns WHERE userId = ? AND channelId = ? AND yearMonth = ?`,
    [userId, channelId, yearMonth]
  );

  const json = JSON.stringify(publishDays);

  if (existing) {
    await run(
      `UPDATE channel_month_patterns
         SET publishDays = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND userId = ?`,
      [json, existing.id, userId]
    );
    const row = await get<ChannelMonthPatternRow>(
      `SELECT id, channelId, yearMonth, publishDays, createdAt, updatedAt
       FROM channel_month_patterns WHERE id = ? AND userId = ?`,
      [existing.id, userId]
    );
    return rowToPattern(row!);
  }

  const result = await run(
    `INSERT INTO channel_month_patterns (userId, channelId, yearMonth, publishDays)
     VALUES (?, ?, ?, ?)`,
    [userId, channelId, yearMonth, json]
  );
  const row = await get<ChannelMonthPatternRow>(
    `SELECT id, channelId, yearMonth, publishDays, createdAt, updatedAt
     FROM channel_month_patterns WHERE id = ? AND userId = ?`,
    [result.lastInsertRowid, userId]
  );
  return rowToPattern(row!);
}
