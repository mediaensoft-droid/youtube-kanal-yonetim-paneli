import "server-only";
import { createClient, type Client, type InArgs } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  // No Turso credentials configured (local dev): fall back to a local SQLite file via the same client API.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: `file:${path.join(DATA_DIR, "app.db")}` });
}

declare global {
  var __appDb: Client | undefined;
  var __appDbSchemaReady: Promise<void> | undefined;
}

export const db: Client = globalThis.__appDb ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__appDb = db;
}

async function bootstrapSchema(): Promise<void> {
  // PRAGMAs are file-mode optimizations; Turso's remote protocol ignores or rejects some of them, so failures here are non-fatal.
  try {
    await db.executeMultiple(`
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
    `);
  } catch {
    // ignore — remote (Turso) connections don't support local file pragmas
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      color     TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      color     TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS channels (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      youtubeId        TEXT NOT NULL UNIQUE,
      url              TEXT NOT NULL,
      name             TEXT NOT NULL,
      thumbnailUrl     TEXT NOT NULL,
      subscriberCount  INTEGER,
      videoCount       INTEGER,
      viewCount        INTEGER,
      categoryId       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      conceptId        INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
      languages        TEXT NOT NULL DEFAULT '[]',
      countries        TEXT NOT NULL DEFAULT '[]',
      notes            TEXT,
      lastRefreshedAt  TEXT,
      createdAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_channels_categoryId ON channels(categoryId);
    CREATE INDEX IF NOT EXISTS idx_channels_name       ON channels(name COLLATE NOCASE);
  `);

  // channels existed before conceptId was introduced; add the column (and its index) for databases created pre-migration.
  const tableInfo = await db.execute(`PRAGMA table_info(channels)`);
  const hasConceptId = tableInfo.rows.some((row) => row.name === "conceptId");
  if (!hasConceptId) {
    try {
      await db.execute(
        `ALTER TABLE channels ADD COLUMN conceptId INTEGER REFERENCES concepts(id) ON DELETE SET NULL`
      );
    } catch (err) {
      // Concurrent cold starts can race this migration; whichever loses hits "duplicate column".
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_conceptId ON channels(conceptId)`);
}

function ensureSchema(): Promise<void> {
  if (!globalThis.__appDbSchemaReady) {
    globalThis.__appDbSchemaReady = bootstrapSchema();
  }
  return globalThis.__appDbSchemaReady;
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export async function all<T = Record<string, unknown>>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureSchema();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function get<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InArgs = []): Promise<RunResult> {
  await ensureSchema();
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    changes: result.rowsAffected,
  };
}
