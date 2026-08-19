import "server-only";
import { all, get, run } from "@/lib/db";
import type { Channel, ChannelFilters } from "@/types";

interface ChannelRow {
  id: number;
  youtubeId: string;
  url: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  categoryId: number | null;
  conceptId: number | null;
  languages: string;
  countries: string;
  notes: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    categoryId: row.categoryId,
    conceptId: row.conceptId,
    languages: JSON.parse(row.languages) as string[],
    countries: JSON.parse(row.countries) as string[],
    notes: row.notes,
    lastRefreshedAt: row.lastRefreshedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listChannels(filters?: ChannelFilters): Promise<Channel[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.categoryId !== undefined) {
    conditions.push(`categoryId = ?`);
    params.push(filters.categoryId);
  }
  if (filters?.conceptId !== undefined) {
    conditions.push(`conceptId = ?`);
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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all<ChannelRow>(
    `SELECT * FROM channels ${where} ORDER BY name COLLATE NOCASE ASC`,
    params
  );
  return rows.map(rowToChannel);
}

export async function getChannelById(id: number): Promise<Channel | undefined> {
  const row = await get<ChannelRow>(`SELECT * FROM channels WHERE id = ?`, [id]);
  return row ? rowToChannel(row) : undefined;
}

export async function getChannelByYoutubeId(youtubeId: string): Promise<Channel | undefined> {
  const row = await get<ChannelRow>(`SELECT * FROM channels WHERE youtubeId = ?`, [youtubeId]);
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
  categoryId: number | null;
  conceptId: number | null;
  languages: string[];
  countries: string[];
  notes: string | null;
}

export async function createChannel(input: CreateChannelRecord): Promise<Channel> {
  const result = await run(
    `INSERT INTO channels
      (youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount, categoryId, conceptId, languages, countries, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.youtubeId,
      input.url,
      input.name,
      input.thumbnailUrl,
      input.subscriberCount,
      input.videoCount,
      input.viewCount,
      input.categoryId,
      input.conceptId,
      JSON.stringify(input.languages),
      JSON.stringify(input.countries),
      input.notes,
    ]
  );
  return (await getChannelById(result.lastInsertRowid))!;
}

export interface UpdateChannelManualFields {
  categoryId?: number | null;
  conceptId?: number | null;
  languages?: string[];
  countries?: string[];
  notes?: string | null;
  url?: string;
}

export async function updateChannelManualFields(
  id: number,
  input: UpdateChannelManualFields
): Promise<Channel> {
  const existing = await getChannelById(id);
  if (!existing) {
    throw new Error(`Channel ${id} not found`);
  }
  const categoryId = input.categoryId !== undefined ? input.categoryId : existing.categoryId;
  const conceptId = input.conceptId !== undefined ? input.conceptId : existing.conceptId;
  const languages = input.languages ?? existing.languages;
  const countries = input.countries ?? existing.countries;
  const notes = input.notes !== undefined ? input.notes : existing.notes;
  const url = input.url ?? existing.url;

  await run(
    `UPDATE channels
       SET categoryId = ?, conceptId = ?, languages = ?, countries = ?, notes = ?, url = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
    [categoryId, conceptId, JSON.stringify(languages), JSON.stringify(countries), notes, url, id]
  );

  return (await getChannelById(id))!;
}

export interface YouTubeRefreshData {
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
}

export async function updateChannelYouTubeData(
  id: number,
  data: YouTubeRefreshData
): Promise<Channel> {
  await run(
    `UPDATE channels
       SET name = ?, thumbnailUrl = ?, subscriberCount = ?, videoCount = ?, viewCount = ?,
           lastRefreshedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
    [data.name, data.thumbnailUrl, data.subscriberCount, data.videoCount, data.viewCount, id]
  );
  return (await getChannelById(id))!;
}

export async function deleteChannel(id: number): Promise<void> {
  await run(`DELETE FROM channels WHERE id = ?`, [id]);
}
