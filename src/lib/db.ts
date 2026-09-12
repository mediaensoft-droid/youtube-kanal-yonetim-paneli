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
      isActive         INTEGER NOT NULL DEFAULT 1,
      categoryIds      TEXT NOT NULL DEFAULT '[]',
      conceptIds       TEXT NOT NULL DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'active',
      aiTools          TEXT NOT NULL DEFAULT '[]',
      createdByMemberId        INTEGER,
      statusChangedByMemberId  INTEGER,
      statusChangedAt          TEXT,
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

  // channels existed before isActive (passive channels stay stored but are hidden from the calendar,
  // dashboard and category/concept counts, and skipped by the daily refresh) was introduced; backfill.
  const hasIsActive = tableInfo.rows.some((row) => row.name === "isActive");
  if (!hasIsActive) {
    try {
      await db.execute(`ALTER TABLE channels ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1`);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
  }

  // Channel status grew a third value ("planned" = a reference channel the user tracks but doesn't
  // own), so the boolean isActive became a `status` column: 'active' | 'passive' | 'planned'.
  // isActive stays in place but is no longer read or written; it seeds `status` exactly once.
  const hasStatus = tableInfo.rows.some((row) => row.name === "status");
  if (!hasStatus) {
    try {
      await db.execute(`ALTER TABLE channels ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
    } catch (err) {
      const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
      if (!isDuplicateColumn) throw err;
    }
    await db.execute(`UPDATE channels SET status = 'passive' WHERE isActive = 0 AND status = 'active'`);
  }

  // A channel can now belong to several categories/concepts. `categoryIds`/`conceptIds` are JSON
  // arrays (same shape as languages/countries); the legacy single-value `categoryId`/`conceptId`
  // columns stay in place but are no longer read or written. Existing values are folded into the
  // arrays exactly once, when the columns are first added.
  const hasCategoryIds = tableInfo.rows.some((row) => row.name === "categoryIds");
  if (!hasCategoryIds) {
    for (const [column, legacy] of [
      ["categoryIds", "categoryId"],
      ["conceptIds", "conceptId"],
    ] as const) {
      try {
        await db.execute(`ALTER TABLE channels ADD COLUMN ${column} TEXT NOT NULL DEFAULT '[]'`);
      } catch (err) {
        const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
        if (!isDuplicateColumn) throw err;
      }
      await db.execute(
        `UPDATE channels SET ${column} = json_array(${legacy}) WHERE ${legacy} IS NOT NULL AND ${column} = '[]'`
      );
    }
  }

  // channels existed before aiTools (E) — the list of AI tool catalog ids a channel is tagged
  // with — was introduced; backfill the column.
  const hasAiTools = tableInfo.rows.some((row) => row.name === "aiTools");
  if (!hasAiTools) {
    try {
      await db.execute(`ALTER TABLE channels ADD COLUMN aiTools TEXT NOT NULL DEFAULT '[]'`);
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

  // Members: every actor in a workspace, the owner included (role 'yonetici', no credentials).
  // Staff rows carry a globally-unique username + bcrypt hash and sign in via Credentials.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      userId       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role         TEXT NOT NULL DEFAULT 'goruntuleyici',
      displayName  TEXT NOT NULL,
      username     TEXT UNIQUE,
      passwordHash TEXT,
      status       TEXT NOT NULL DEFAULT 'active',
      lastLoginAt  TEXT,
      createdAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_members_userId ON members(userId)`);
  await db.execute(
    `DROP INDEX IF EXISTS idx_members_owner`
  );
  // The owner row is the Google-authenticated member (no username); staff can also hold the
  // yonetici role, so uniqueness is keyed on ownership rather than role.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_owner_row ON members(userId) WHERE username IS NULL`
  );

  // Who-did-what audit trail (B). memberId is nullable so a removed member's history survives
  // them; entityName snapshots the name at the time of the action so it still reads sensibly
  // after the underlying channel/category/member row is gone.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      userId     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      memberId   INTEGER REFERENCES members(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId   INTEGER,
      entityName TEXT,
      details    TEXT,
      createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_userId_createdAt ON activity_log(userId, createdAt)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_userId_memberId_createdAt ON activity_log(userId, memberId, createdAt)`
  );

  // Task board (C): Trello-style columns + cards per workspace. isDone marks the column(s) whose
  // cards count as completed (drives tasks.completedAt and the task.complete activity log).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_columns (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name      TEXT NOT NULL,
      position  INTEGER NOT NULL DEFAULT 0,
      isDone    INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_task_columns_userId_position ON task_columns(userId, position)`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      userId            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      columnId          INTEGER NOT NULL REFERENCES task_columns(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      description       TEXT,
      assigneeMemberId  INTEGER REFERENCES members(id) ON DELETE SET NULL,
      channelId         INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      dueDate           TEXT,
      priority          TEXT NOT NULL DEFAULT 'normal',
      position          INTEGER NOT NULL DEFAULT 0,
      checklist         TEXT NOT NULL DEFAULT '[]',
      createdByMemberId INTEGER REFERENCES members(id) ON DELETE SET NULL,
      completedAt       TEXT,
      createdAt         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_tasks_userId_columnId_position ON tasks(userId, columnId, position)`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      memberId  INTEGER REFERENCES members(id) ON DELETE SET NULL,
      body      TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_task_comments_taskId ON task_comments(taskId)`);

  // Personal notes (D): every member (owner included) has their own private notebook. The owner
  // can read staff notes (enforced in the API layer, not here) but never the reverse, and nobody
  // edits anyone else's notes. Not logged to activity_log — these are meant to stay private.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      memberId  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      title     TEXT NOT NULL DEFAULT '',
      body      TEXT NOT NULL DEFAULT '',
      pinned    INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_notes_userId_memberId_updatedAt ON notes(userId, memberId, updatedAt)`
  );

  // Belge Havuzu (F): a shared, per-workspace folder tree + files stored in Vercel Blob.
  // parentId CASCADEs so deleting a folder drops its whole subfolder chain; folderId on files is
  // SET NULL by the FK (a safety net against orphaned rows), but deleteFolder() in db/files.ts
  // explicitly deletes descendant file rows (and their blobs) first so "delete folder" really means
  // delete its contents, not silently move them back to the root.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS doc_folders (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      userId            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parentId          INTEGER REFERENCES doc_folders(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      createdByMemberId INTEGER REFERENCES members(id) ON DELETE SET NULL,
      createdAt         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_doc_folders_userId_parentId ON doc_folders(userId, parentId)`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS doc_files (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      userId             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folderId           INTEGER REFERENCES doc_folders(id) ON DELETE SET NULL,
      name               TEXT NOT NULL,
      blobUrl            TEXT NOT NULL,
      blobPathname       TEXT,
      size               INTEGER NOT NULL,
      contentType        TEXT NOT NULL,
      description        TEXT,
      uploadedByMemberId INTEGER REFERENCES members(id) ON DELETE SET NULL,
      createdAt          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_doc_files_userId_folderId ON doc_files(userId, folderId)`
  );

  // Ekip Mesajlaşması (G): one shared 'general' conversation per workspace plus 1:1 DMs between
  // members. DM rows store the pair sorted (memberAId < memberBId) so a unique index can prevent
  // duplicate DM conversations regardless of who initiated it.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type      TEXT NOT NULL DEFAULT 'general',
      memberAId INTEGER REFERENCES members(id) ON DELETE SET NULL,
      memberBId INTEGER REFERENCES members(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_conversations_userId_type ON conversations(userId, type)`
  );
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_dm_pair ON conversations(userId, memberAId, memberBId) WHERE type = 'dm'`
  );
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_general ON conversations(userId) WHERE type = 'general'`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      memberId       INTEGER REFERENCES members(id) ON DELETE SET NULL,
      body           TEXT NOT NULL DEFAULT '',
      attachmentUrl  TEXT,
      attachmentName TEXT,
      attachmentSize INTEGER,
      attachmentType TEXT,
      createdAt      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_messages_conversationId_id ON messages(conversationId, id)`
  );

  // Per-member read cursor per conversation — upserted, and never moved backwards (see
  // markRead() in db/messages.ts), so switching devices can't un-read something already seen.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversation_reads (
      conversationId    INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      memberId          INTEGER REFERENCES members(id) ON DELETE CASCADE,
      lastReadMessageId INTEGER NOT NULL DEFAULT 0,
      updatedAt         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (conversationId, memberId)
    )
  `);

  // One owner row per workspace; existing workspaces get theirs here, new ones in the auth callback.
  await db.execute(`
    INSERT INTO members (userId, role, displayName)
    SELECT u.id, 'yonetici', COALESCE(NULLIF(u.name, ''), u.email)
      FROM users u
     WHERE NOT EXISTS (SELECT 1 FROM members m WHERE m.userId = u.id AND m.username IS NULL)
  `);

  // Who added a channel / who last changed its status. Pre-existing channels are attributed to the
  // workspace owner (the only possible actor before staff accounts existed).
  const hasCreatedBy = tableInfo.rows.some((row) => row.name === "createdByMemberId");
  if (!hasCreatedBy) {
    for (const ddl of [
      `ALTER TABLE channels ADD COLUMN createdByMemberId INTEGER REFERENCES members(id) ON DELETE SET NULL`,
      `ALTER TABLE channels ADD COLUMN statusChangedByMemberId INTEGER REFERENCES members(id) ON DELETE SET NULL`,
      `ALTER TABLE channels ADD COLUMN statusChangedAt TEXT`,
    ]) {
      try {
        await db.execute(ddl);
      } catch (err) {
        const isDuplicateColumn = err instanceof Error && /duplicate column/i.test(err.message);
        if (!isDuplicateColumn) throw err;
      }
    }
  }
  // Backfill deferred to after the multi-tenant rebuild below — channels.userId doesn't exist yet
  // on a database that has never been through that rebuild (see the backfill after idx_channels_userId_status).

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
          publishDays      TEXT NOT NULL DEFAULT '[]',
          publishTime      TEXT,
          isActive         INTEGER NOT NULL DEFAULT 1,
          categoryIds      TEXT NOT NULL DEFAULT '[]',
          conceptIds       TEXT NOT NULL DEFAULT '[]',
          status           TEXT NOT NULL DEFAULT 'active',
          aiTools          TEXT NOT NULL DEFAULT '[]',
          createdByMemberId        INTEGER,
          statusChangedByMemberId  INTEGER,
          statusChangedAt          TEXT,
          lastRefreshedAt  TEXT,
          createdAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UNIQUE(userId, youtubeId)
        );
        INSERT INTO channels_new
          (id, userId, youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount,
           categoryId, conceptId, languages, countries, notes, publishDays, publishTime, isActive,
           categoryIds, conceptIds, status, aiTools, createdByMemberId, statusChangedByMemberId, statusChangedAt,
           lastRefreshedAt, createdAt, updatedAt)
        SELECT id, NULL, youtubeId, url, name, thumbnailUrl, subscriberCount, videoCount, viewCount,
               categoryId, conceptId, languages, countries, notes, publishDays, publishTime, isActive,
               categoryIds, conceptIds, status, aiTools, createdByMemberId, statusChangedByMemberId, statusChangedAt,
               lastRefreshedAt, createdAt, updatedAt
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

  // channels.userId is guaranteed to exist from here on (base column, or added by the multi-tenant
  // rebuild above), so this index — needed by every userId-scoped channel query — is safe to create.
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_userId_status ON channels(userId, status)`);

  // Who added a channel, backfilled to the workspace owner for pre-existing channels (the only
  // possible actor before staff accounts existed). Deferred to here (rather than right after the
  // members table above) because it reads channels.userId, which — like the index just above —
  // isn't guaranteed to exist until the multi-tenant rebuild has run.
  await db.execute(`
    UPDATE channels
       SET createdByMemberId = (SELECT m.id FROM members m WHERE m.userId = channels.userId AND m.username IS NULL)
     WHERE createdByMemberId IS NULL
  `);

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
