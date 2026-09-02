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
      publishDays      TEXT NOT NULL DEFAULT '[]',
      publishTime      TEXT,
      lastRefreshedAt  TEXT,
      createdAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_channels_categoryId ON channels(categoryId);
    CREATE INDEX IF NOT EXISTS idx_channels_name       ON channels(name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS channel_snapshots (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      channelId        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      subscriberCount  INTEGER,
      videoCount       INTEGER,
      viewCount        INTEGER,
      capturedAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_channelId_capturedAt ON channel_snapshots(channelId, capturedAt);

    CREATE TABLE IF NOT EXISTS channel_analysis_cache (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      youtubeChannelId TEXT NOT NULL UNIQUE,
      channelName      TEXT NOT NULL,
      targetAgeGroup   TEXT NOT NULL,
      targetCountry    TEXT NOT NULL,
      thumbnailQuality TEXT NOT NULL,
      textQuality      TEXT NOT NULL,
      languageGaps     TEXT NOT NULL DEFAULT '[]',
      rpm              REAL,
      monthlyRevenue   REAL,
      audienceFit      TEXT,
      createdAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_cache_youtubeChannelId ON channel_analysis_cache(youtubeChannelId);
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

  // channels existed before publishDays (weekly upload-day pattern) was introduced; backfill the column.
  const hasPublishDays = tableInfo.rows.some((row) => row.name === "publishDays");
  if (!hasPublishDays) {
    try {
      await db.execute(`ALTER TABLE channels ADD COLUMN publishDays TEXT NOT NULL DEFAULT '[]'`);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }

  // channels existed before publishTime (default "HH:MM" upload time) was introduced; backfill the column.
  const hasPublishTime = tableInfo.rows.some((row) => row.name === "publishTime");
  if (!hasPublishTime) {
    try {
      await db.execute(`ALTER TABLE channels ADD COLUMN publishTime TEXT`);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }

  // Multi-tenant migration: a `users` table plus per-row ownership on channels/categories/concepts.
  // SQLite can't alter a UNIQUE constraint in place, so youtubeId/name uniqueness moves from
  // globally-unique to composite (userId, youtubeId)/(userId, name) via a full table rebuild —
  // this only runs once per database, guarded by the presence of the `userId` column.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      email     TEXT NOT NULL UNIQUE,
      name      TEXT,
      image     TEXT,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      userId                INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan                  TEXT NOT NULL DEFAULT 'pro',
      status                TEXT NOT NULL DEFAULT 'trialing',
      iyzicoSubscriptionRef TEXT,
      iyzicoCustomerRef     TEXT,
      currentPeriodEnd      TEXT,
      trialEndsAt           TEXT,
      createdAt             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_subscriptions_userId ON subscriptions(userId)`);

  // Publish calendar: tracks the actual per-date status of a channel's video (planned/published/skipped).
  // The channel's `publishDays` (weekday pattern) drives which dates show up as "planned" by default;
  // a row here only exists once the user overrides that default or adds an ad-hoc extra upload.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channelId INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,
      title       TEXT,
      status      TEXT NOT NULL DEFAULT 'planned',
      notes       TEXT,
      publishedAt TEXT,
      createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(channelId, date)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_schedule_entries_userId_date ON schedule_entries(userId, date)`
  );

  // schedule_entries existed before publishedAt (real timestamp of when status became 'published',
  // used for "yayınlanalı X önce" tooltips) was introduced; backfill the column.
  const scheduleEntriesInfo = await db.execute(`PRAGMA table_info(schedule_entries)`);
  const hasPublishedAt = scheduleEntriesInfo.rows.some((row) => row.name === "publishedAt");
  if (!hasPublishedAt) {
    try {
      await db.execute(`ALTER TABLE schedule_entries ADD COLUMN publishedAt TEXT`);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }

  // Per-month override of a channel's weekly publish-day pattern. Absent a row here for a given
  // (channel, month), the calendar falls back to the channel's global `publishDays` template —
  // this table only stores months the user has explicitly edited, so a day toggled while viewing
  // one month never silently changes any other month.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS channel_month_patterns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      userId      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channelId   INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      yearMonth   TEXT NOT NULL,
      publishDays TEXT NOT NULL DEFAULT '[]',
      createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(channelId, yearMonth)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_channel_month_patterns_userId_yearMonth ON channel_month_patterns(userId, yearMonth)`
  );

  const channelsInfo = await db.execute(`PRAGMA table_info(channels)`);
  const categoriesInfo = await db.execute(`PRAGMA table_info(categories)`);
  const conceptsInfo = await db.execute(`PRAGMA table_info(concepts)`);
  const channelsNeedUserId = !channelsInfo.rows.some((row) => row.name === "userId");
  const categoriesNeedUserId = !categoriesInfo.rows.some((row) => row.name === "userId");
  const conceptsNeedUserId = !conceptsInfo.rows.some((row) => row.name === "userId");

  if (channelsNeedUserId || categoriesNeedUserId || conceptsNeedUserId) {
    try {
      await db.executeMultiple(`PRAGMA foreign_keys = OFF;`);
    } catch {
      // ignore — remote (Turso) connections may reject local pragmas
    }

    if (channelsNeedUserId) {
      await db.executeMultiple(`
        CREATE TABLE channels_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          userId           INTEGER REFERENCES users(id) ON DELETE CASCADE,
          youtubeId        TEXT NOT NULL,
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
          updatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UNIQUE(userId, youtubeId)
        );
        INSERT INTO channels_new
          (id, userId, youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount,
           categoryId, conceptId, languages, countries, notes, lastRefreshedAt, createdAt, updatedAt)
        SELECT id, NULL, youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount,
               categoryId, conceptId, languages, countries, notes, lastRefreshedAt, createdAt, updatedAt
        FROM channels;
        DROP TABLE channels;
        ALTER TABLE channels_new RENAME TO channels;
        CREATE INDEX IF NOT EXISTS idx_channels_categoryId ON channels(categoryId);
        CREATE INDEX IF NOT EXISTS idx_channels_conceptId ON channels(conceptId);
        CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_channels_userId ON channels(userId);
      `);
    }

    if (categoriesNeedUserId) {
      await db.executeMultiple(`
        CREATE TABLE categories_new (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          userId    INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name      TEXT NOT NULL,
          color     TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UNIQUE(userId, name)
        );
        INSERT INTO categories_new (id, userId, name, color, createdAt)
        SELECT id, NULL, name, color, createdAt FROM categories;
        DROP TABLE categories;
        ALTER TABLE categories_new RENAME TO categories;
        CREATE INDEX IF NOT EXISTS idx_categories_userId ON categories(userId);
      `);
    }

    if (conceptsNeedUserId) {
      await db.executeMultiple(`
        CREATE TABLE concepts_new (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          userId    INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name      TEXT NOT NULL,
          color     TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UNIQUE(userId, name)
        );
        INSERT INTO concepts_new (id, userId, name, color, createdAt)
        SELECT id, NULL, name, color, createdAt FROM concepts;
        DROP TABLE concepts;
        ALTER TABLE concepts_new RENAME TO concepts;
        CREATE INDEX IF NOT EXISTS idx_concepts_userId ON concepts(userId);
      `);
    }

    try {
      await db.executeMultiple(`PRAGMA foreign_keys = ON;`);
    } catch {
      // ignore
    }
  }

  // One-time production data-ownership backfill: pre-multi-tenancy rows (userId IS NULL) are
  // attached to the operator's own account so existing data isn't orphaned. Safe to run every
  // cold start — a no-op once every row has an owner.
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    const existingOwner = await db.execute(`SELECT id FROM users WHERE email = ?`, [ownerEmail]);
    let ownerId: number;
    if (existingOwner.rows.length > 0) {
      ownerId = Number(existingOwner.rows[0].id);
    } else {
      const inserted = await db.execute(`INSERT INTO users (email) VALUES (?)`, [ownerEmail]);
      ownerId = Number(inserted.lastInsertRowid);
    }
    await db.execute(`UPDATE channels SET userId = ? WHERE userId IS NULL`, [ownerId]);
    await db.execute(`UPDATE categories SET userId = ? WHERE userId IS NULL`, [ownerId]);
    await db.execute(`UPDATE concepts SET userId = ? WHERE userId IS NULL`, [ownerId]);
  }

  // Channels created before the growth-trend feature existed have no snapshot history yet;
  // backfill one initial snapshot from their current stats so a trend line can start forming.
  await db.execute(`
    INSERT INTO channel_snapshots (channelId, subscriberCount, videoCount, viewCount, capturedAt)
    SELECT id, subscriberCount, videoCount, viewCount, createdAt
    FROM channels
    WHERE id NOT IN (SELECT DISTINCT channelId FROM channel_snapshots)
  `);
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
