import "server-only";
import { all, get, run } from "@/lib/db";
import type { Channel, ChannelFilters, ChannelStatus } from "@/types";

interface ChannelRow {
  id: number;
  youtubeId: string;
  url: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  categoryIds: string;
  conceptIds: string;
  languages: string;
  countries: string;
  notes: string | null;
  publishDays: string;
  publishTime: string | null;
  status: ChannelStatus;
  createdByMemberId: number | null;
  statusChangedByMemberId: number | null;
  statusChangedAt: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChannelRowWithOwner extends ChannelRow {
  userId: number;
}

function rowToChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    youtubeId: row.youtubeId,
    url: row.url,
    name: row.name,
    thumbnailUrl: row.thumbnailUrl,
    subscriberCount: row.subscriberCount,
    videoCount: row.videoCount,
    viewCount: row.viewCount,
    categoryIds: JSON.parse(row.categoryIds) as number[],
    conceptIds: JSON.parse(row.conceptIds) as number[],
    languages: JSON.parse(row.languages) as string[],
    countries: JSON.parse(row.countries) as string[],
    notes: row.notes,
    publishDays: JSON.parse(row.publishDays) as number[],
    publishTime: row.publishTime,
    status: row.status,
    createdByMemberId: row.createdByMemberId,
    statusChangedByMemberId: row.statusChangedByMemberId,
    statusChangedAt: row.statusChangedAt,
    lastRefreshedAt: row.lastRefreshedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listChannels(userId: number, filters?: ChannelFilters): Promise<Channel[]> {
  const conditions: string[] = [`userId = ?`];
  const params: (string | number)[] = [userId];

  // Only the user's active channels show up by default (dashboard, calendar, list); the passive and
  // planned screens ask for their own status explicitly.
  const status = filters?.status ?? "active";
  if (status !== "all") {
    conditions.push(`status = ?`);
    params.push(status);
  }

  // "Has this category/concept" — a channel can carry several, so match inside the JSON array.
  if (filters?.categoryId !== undefined) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(categoryIds) WHERE value = ?)`);
    params.push(filters.categoryId);
  }
  if (filters?.conceptId !== undefined) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(conceptIds) WHERE value = ?)`);
    params.push(filters.conceptId);
  }
  if (filters?.language) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(languages) WHERE value = ?)`);
    params.push(filters.language);
  }
  if (filters?.country) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(countries) WHERE value = ?)`);
    params.push(filters.country);
  }
  if (filters?.search) {
    conditions.push(`name LIKE ? COLLATE NOCASE`);
    params.push(`%${filters.search}%`);
  }

  const rows = await all<ChannelRow>(
    `SELECT * FROM channels WHERE ${conditions.join(" AND ")} ORDER BY name COLLATE NOCASE ASC`,
    params
  );
  return rows.map(rowToChannel);
}

/**
 * Unscoped — every tenant's active and planned channels, for the daily cron refresh job only.
 * Planned (reference) channels are refreshed too — tracking their growth is their whole point;
 * passive ones are skipped so they don't burn YouTube API quota.
 * Never expose this via a user-facing API route.
 */
export async function listAllChannelsForRefresh(): Promise<(Channel & { userId: number })[]> {
  const rows = await all<ChannelRowWithOwner>(
    `SELECT * FROM channels WHERE status IN ('active', 'planned') ORDER BY id ASC`
  );
  return rows.map((row) => ({ ...rowToChannel(row), userId: row.userId }));
}

// The user's OWN channels (active + passive) against the plan's channel limit. A passive channel
// still occupies a slot, otherwise parking channels would be a free way around the limit. Planned
// (reference) channels have their own separate limit — see countPlannedChannelsForUser.
export async function countChannelsForUser(userId: number): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM channels WHERE userId = ? AND status != 'planned'`,
    [userId]
  );
  return row?.count ?? 0;
}

export async function countPlannedChannelsForUser(userId: number): Promise<number> {
  return countChannelsByStatus(userId, "planned");
}

export async function countChannelsByStatus(userId: number, status: ChannelStatus): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM channels WHERE userId = ? AND status = ?`,
    [userId, status]
  );
  return row?.count ?? 0;
}

// Platform-wide total, shown as honest usage evidence on the public /sign-in page —
// not a per-user figure, and not a claimed customer/testimonial count.
export async function countAllChannels(): Promise<number> {
  const row = await get<{ count: number }>(`SELECT COUNT(*) as count FROM channels`);
  return row?.count ?? 0;
}

// Real per-channel subscriber counts, powering the /sign-in hero's growth card — every bar is a
// live channel's actual subscriberCount, never a fabricated trend.
export async function getSubscriberSnapshot(): Promise<{ total: number; bars: number[] }> {
  const rows = await all<{ subscriberCount: number | null }>(
    `SELECT subscriberCount FROM channels WHERE subscriberCount IS NOT NULL ORDER BY subscriberCount DESC`
  );
  const counts = rows.map((row) => row.subscriberCount ?? 0);
  return {
    total: counts.reduce((sum, count) => sum + count, 0),
    bars: counts.slice(0, 24),
  };
}

export async function getChannelById(userId: number, id: number): Promise<Channel | undefined> {
  const row = await get<ChannelRow>(`SELECT * FROM channels WHERE id = ? AND userId = ?`, [
    id,
    userId,
  ]);
  return row ? rowToChannel(row) : undefined;
}

export async function getChannelByYoutubeId(
  userId: number,
  youtubeId: string
): Promise<Channel | undefined> {
  const row = await get<ChannelRow>(`SELECT * FROM channels WHERE youtubeId = ? AND userId = ?`, [
    youtubeId,
    userId,
  ]);
  return row ? rowToChannel(row) : undefined;
}

export interface CreateChannelRecord {
  youtubeId: string;
  url: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  categoryIds: number[];
  conceptIds: number[];
  languages: string[];
  countries: string[];
  notes: string | null;
  status: ChannelStatus;
  createdByMemberId: number;
}

export async function createChannel(userId: number, input: CreateChannelRecord): Promise<Channel> {
  const result = await run(
    `INSERT INTO channels
      (userId, youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount, categoryIds, conceptIds, languages, countries, notes, status, createdByMemberId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.youtubeId,
      input.url,
      input.name,
      input.thumbnailUrl,
      input.subscriberCount,
      input.videoCount,
      input.viewCount,
      JSON.stringify(input.categoryIds),
      JSON.stringify(input.conceptIds),
      JSON.stringify(input.languages),
      JSON.stringify(input.countries),
      input.notes,
      input.status,
      input.createdByMemberId,
    ]
  );
  return (await getChannelById(userId, result.lastInsertRowid))!;
}

export interface UpdateChannelManualFields {
  categoryIds?: number[];
  conceptIds?: number[];
  languages?: string[];
  countries?: string[];
  notes?: string | null;
  publishDays?: number[];
  publishTime?: string | null;
  url?: string;
}

export async function updateChannelManualFields(
  userId: number,
  id: number,
  input: UpdateChannelManualFields
): Promise<Channel> {
  const existing = await getChannelById(userId, id);
  if (!existing) {
    throw new Error(`Channel ${id} not found`);
  }
  const categoryIds = input.categoryIds ?? existing.categoryIds;
  const conceptIds = input.conceptIds ?? existing.conceptIds;
  const languages = input.languages ?? existing.languages;
  const countries = input.countries ?? existing.countries;
  const notes = input.notes !== undefined ? input.notes : existing.notes;
  const publishDays = input.publishDays ?? existing.publishDays;
  const publishTime = input.publishTime !== undefined ? input.publishTime : existing.publishTime;
  const url = input.url ?? existing.url;

  await run(
    `UPDATE channels
       SET categoryIds = ?, conceptIds = ?, languages = ?, countries = ?, notes = ?, publishDays = ?, publishTime = ?, url = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ? AND userId = ?`,
    [
      JSON.stringify(categoryIds),
      JSON.stringify(conceptIds),
      JSON.stringify(languages),
      JSON.stringify(countries),
      notes,
      JSON.stringify(publishDays),
      publishTime,
      url,
      id,
      userId,
    ]
  );

  return (await getChannelById(userId, id))!;
}

export interface YouTubeRefreshData {
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
}

export async function updateChannelYouTubeData(
  userId: number,
  id: number,
  data: YouTubeRefreshData
): Promise<Channel> {
  await run(
    `UPDATE channels
       SET name = ?, thumbnailUrl = ?, subscriberCount = ?, videoCount = ?, viewCount = ?,
           lastRefreshedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ? AND userId = ?`,
    [data.name, data.thumbnailUrl, data.subscriberCount, data.videoCount, data.viewCount, id, userId]
  );
  return (await getChannelById(userId, id))!;
}

export async function setChannelStatus(
  userId: number,
  id: number,
  status: ChannelStatus,
  changedByMemberId: number
): Promise<Channel> {
  await run(
    `UPDATE channels
        SET status = ?, statusChangedByMemberId = ?, statusChangedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND userId = ?`,
    [status, changedByMemberId, id, userId]
  );
  return (await getChannelById(userId, id))!;
}

export async function deleteChannel(userId: number, id: number): Promise<void> {
  await run(`DELETE FROM channels WHERE id = ? AND userId = ?`, [id, userId]);
}
