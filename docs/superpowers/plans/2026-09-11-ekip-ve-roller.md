# Ekip & Roller (A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff accounts (username + password) under the owner's workspace with four roles, server-enforced permissions, channel delete restricted to Yönetici/Vekil, and "who added / who passivated" attribution on channel detail.

**Architecture:** A `members` table holds every actor (owner row = `yonetici`, staff rows = username + bcrypt hash). NextAuth gains a Credentials provider; the JWT/session keeps `session.user.id` = workspace (owner) id so every existing `userId`-scoped query keeps working, and adds `session.member = { id, role, displayName }`. A pure `can(role, permission)` matrix drives both server checks (`requirePermission`) and UI hiding (`useActor`).

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (JWT), @libsql/client (Turso / local SQLite), zod 4, bcryptjs, vitest (new, unit tests for pure modules), Tailwind, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-09-11-ekip-ve-roller-design.md`

## Global Constraints

- `session.user.id` MUST remain the workspace (owner) id; `getSessionUserId()` semantics unchanged.
- Roles: `yonetici` | `vekil` | `duzenleyici` | `goruntuleyici` (exact strings, stored in DB).
- Username: lowercase, 3–30 chars, `^[a-z0-9._-]{3,30}$`, globally unique. Password: min 8 chars, bcrypt cost 10.
- Error copy (verbatim): 403 → `"Bu işlem için yetkiniz yok"`; 409 username → `"Bu kullanıcı adı kullanımda"`; bad login → `"Kullanıcı adı veya şifre hatalı"`; disabled → `"Hesabınız pasif, yöneticinize başvurun"`.
- No member delete in v1 — only `status = 'disabled'`.
- All migrations idempotent, additive, guarded by `PRAGMA table_info` like the existing ones in `src/lib/db.ts`.
- Never start `next dev` with the real Turso vars: always `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx next dev -p 31xx` (prod creds live in `.env.local`).
- Commit messages in Turkish, ending with the session attribution trailer used in this repo.

---

### Task 1: Test tooling + password hashing

**Files:**
- Modify: `package.json` (scripts + deps)
- Create: `vitest.config.ts`
- Create: `src/lib/password.ts`
- Test: `src/lib/__tests__/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`

- [ ] **Step 1: Install deps**

```bash
npm i bcryptjs && npm i -D vitest @types/bcryptjs
```

- [ ] **Step 2: Add test script and vitest config**

`package.json` scripts: add `"test": "vitest run"`.

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Write the failing test**

`src/lib/__tests__/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("verifies the original and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).not.toBe("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify it fails** — `npm test` → FAIL (module not found).

- [ ] **Step 5: Implement**

`src/lib/password.ts` (no `server-only` import so vitest can load it; only ever imported from server code):
```ts
import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 6: Run `npm test`** → PASS. Commit: `Vitest + bcrypt şifre yardımcıları`.

---

### Task 2: Role & permission matrix (pure)

**Files:**
- Create: `src/lib/roles.ts`
- Test: `src/lib/__tests__/roles.test.ts`

**Interfaces:**
- Produces: `type MemberRole`, `type Permission`, `can(role, permission): boolean`, `ROLE_LABELS: Record<MemberRole,string>`, `STAFF_ROLES: MemberRole[]`, `isMemberRole(x: unknown): x is MemberRole`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { can, isMemberRole, STAFF_ROLES } from "@/lib/roles";

describe("can()", () => {
  it("yonetici can do everything", () => {
    for (const p of ["channel.write", "channel.delete", "taxonomy.write", "schedule.write", "team.manage", "billing.view"] as const) {
      expect(can("yonetici", p)).toBe(true);
    }
  });
  it("vekil: everything except team/billing", () => {
    expect(can("vekil", "channel.delete")).toBe(true);
    expect(can("vekil", "team.manage")).toBe(false);
    expect(can("vekil", "billing.view")).toBe(false);
  });
  it("duzenleyici: writes but no delete", () => {
    expect(can("duzenleyici", "channel.write")).toBe(true);
    expect(can("duzenleyici", "schedule.write")).toBe(true);
    expect(can("duzenleyici", "channel.delete")).toBe(false);
  });
  it("goruntuleyici: read-only", () => {
    expect(can("goruntuleyici", "channel.write")).toBe(false);
    expect(can("goruntuleyici", "taxonomy.write")).toBe(false);
    expect(can("goruntuleyici", "schedule.write")).toBe(false);
  });
  it("role guard", () => {
    expect(isMemberRole("vekil")).toBe(true);
    expect(isMemberRole("admin")).toBe(false);
    expect(STAFF_ROLES).not.toContain("yonetici");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `src/lib/roles.ts`**

```ts
export type MemberRole = "yonetici" | "vekil" | "duzenleyici" | "goruntuleyici";

export const ROLE_LABELS: Record<MemberRole, string> = {
  yonetici: "Yönetici",
  vekil: "Vekil",
  duzenleyici: "Düzenleyici",
  goruntuleyici: "Görüntüleyici",
};

/** Roles the owner can assign to staff (the owner alone is yonetici). */
export const STAFF_ROLES: MemberRole[] = ["vekil", "duzenleyici", "goruntuleyici"];

export type Permission =
  | "channel.write" // add / edit / refresh / status change (incl. planned)
  | "channel.delete"
  | "taxonomy.write" // categories & concepts
  | "schedule.write" // calendar entries + publish-day patterns
  | "team.manage" // /team + member APIs
  | "billing.view"; // /billing, /profile (owner-only areas)

const MATRIX: Record<MemberRole, Permission[]> = {
  yonetici: ["channel.write", "channel.delete", "taxonomy.write", "schedule.write", "team.manage", "billing.view"],
  vekil: ["channel.write", "channel.delete", "taxonomy.write", "schedule.write"],
  duzenleyici: ["channel.write", "taxonomy.write", "schedule.write"],
  goruntuleyici: [],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return value === "yonetici" || value === "vekil" || value === "duzenleyici" || value === "goruntuleyici";
}
```

- [ ] **Step 4: `npm test`** → PASS. Commit: `Rol ve yetki matrisi`.

---

### Task 3: Schema migration + members DB module + channel attribution columns

**Files:**
- Modify: `src/lib/db.ts` (after the `status` migration block, before the multi-tenant block)
- Create: `src/lib/db/members.ts`
- Modify: `src/types/index.ts` (Channel fields), `src/lib/db/channels.ts`

**Interfaces:**
- Produces (members.ts): `interface Member { id; userId; role: MemberRole; displayName; username: string|null; status: "active"|"disabled"; lastLoginAt; createdAt; updatedAt }` (no passwordHash exposed), `ensureOwnerMember(userId, displayName): Promise<Member>`, `getMemberById(id)`, `getMemberByUsername(username)` → `Member & { passwordHash: string|null }`, `listMembers(userId)`, `createMember(userId, {displayName, username, passwordHash, role})`, `updateMember(userId, id, {displayName?, role?, status?})`, `setMemberPasswordHash(userId, id, hash)`, `touchMemberLogin(id)`, `isUsernameTaken(username)`.
- Produces (channels.ts): `Channel.createdByMemberId: number|null`, `Channel.statusChangedByMemberId: number|null`, `Channel.statusChangedAt: string|null`; `createChannel(userId, input & { createdByMemberId: number })`; `setChannelStatus(userId, id, status, changedByMemberId: number)`.

- [ ] **Step 1: Migration in `src/lib/db.ts`** (insert right after the `idx_channels_userId_status` line):

```ts
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
  // One owner row per workspace; existing workspaces get theirs here, new ones in the auth callback.
  await db.execute(`
    INSERT INTO members (userId, role, displayName)
    SELECT u.id, 'yonetici', COALESCE(NULLIF(u.name, ''), u.email)
      FROM users u
     WHERE NOT EXISTS (SELECT 1 FROM members m WHERE m.userId = u.id AND m.role = 'yonetici')
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
  await db.execute(`
    UPDATE channels
       SET createdByMemberId = (SELECT m.id FROM members m WHERE m.userId = channels.userId AND m.role = 'yonetici')
     WHERE createdByMemberId IS NULL
  `);
```

Also add the three columns to the base `CREATE TABLE channels` and to the `channels_new` rebuild (CREATE + INSERT column lists), matching how `status` was added.

- [ ] **Step 2: `src/lib/db/members.ts`**

```ts
import "server-only";
import { all, get, run } from "@/lib/db";
import type { MemberRole } from "@/lib/roles";

export type MemberStatus = "active" | "disabled";

export interface Member {
  id: number;
  userId: number;
  role: MemberRole;
  displayName: string;
  username: string | null;
  status: MemberStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type MemberRow = Member & { passwordHash: string | null };

const PUBLIC_COLUMNS = `id, userId, role, displayName, username, status, lastLoginAt, createdAt, updatedAt`;

export async function ensureOwnerMember(userId: number, displayName: string): Promise<Member> {
  const existing = await get<Member>(
    `SELECT ${PUBLIC_COLUMNS} FROM members WHERE userId = ? AND role = 'yonetici'`,
    [userId]
  );
  if (existing) return existing;
  const result = await run(`INSERT INTO members (userId, role, displayName) VALUES (?, 'yonetici', ?)`, [
    userId,
    displayName,
  ]);
  return (await getMemberById(result.lastInsertRowid))!;
}

export async function getMemberById(id: number): Promise<Member | undefined> {
  return get<Member>(`SELECT ${PUBLIC_COLUMNS} FROM members WHERE id = ?`, [id]);
}

/** Login lookup — the only place the hash leaves the DB layer. */
export async function getMemberByUsername(username: string): Promise<MemberRow | undefined> {
  return get<MemberRow>(`SELECT ${PUBLIC_COLUMNS}, passwordHash FROM members WHERE username = ?`, [username]);
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  return Boolean(await get<{ id: number }>(`SELECT id FROM members WHERE username = ?`, [username]));
}

export async function listMembers(userId: number): Promise<Member[]> {
  return all<Member>(
    `SELECT ${PUBLIC_COLUMNS} FROM members WHERE userId = ?
      ORDER BY CASE role WHEN 'yonetici' THEN 0 ELSE 1 END, displayName COLLATE NOCASE`,
    [userId]
  );
}

export interface CreateMemberInput {
  displayName: string;
  username: string;
  passwordHash: string;
  role: MemberRole;
}

export async function createMember(userId: number, input: CreateMemberInput): Promise<Member> {
  const result = await run(
    `INSERT INTO members (userId, role, displayName, username, passwordHash) VALUES (?, ?, ?, ?, ?)`,
    [userId, input.role, input.displayName, input.username, input.passwordHash]
  );
  return (await getMemberById(result.lastInsertRowid))!;
}

export interface UpdateMemberInput {
  displayName?: string;
  role?: MemberRole;
  status?: MemberStatus;
}

export async function updateMember(userId: number, id: number, input: UpdateMemberInput): Promise<Member> {
  const existing = await get<Member>(`SELECT ${PUBLIC_COLUMNS} FROM members WHERE id = ? AND userId = ?`, [id, userId]);
  if (!existing) throw new Error("Üye bulunamadı");
  const displayName = input.displayName ?? existing.displayName;
  const role = input.role ?? existing.role;
  const status = input.status ?? existing.status;
  await run(
    `UPDATE members SET displayName = ?, role = ?, status = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND userId = ?`,
    [displayName, role, status, id, userId]
  );
  return (await getMemberById(id))!;
}

export async function setMemberPasswordHash(userId: number, id: number, passwordHash: string): Promise<void> {
  await run(
    `UPDATE members SET passwordHash = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND userId = ?`,
    [passwordHash, id, userId]
  );
}

export async function touchMemberLogin(id: number): Promise<void> {
  await run(`UPDATE members SET lastLoginAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, [id]);
}
```

- [ ] **Step 3: Channel type + DB**

`src/types/index.ts` `Channel`: add after `status`:
```ts
  createdByMemberId: number | null;
  statusChangedByMemberId: number | null;
  statusChangedAt: string | null;
```
`src/lib/db/channels.ts`: add the same three to `ChannelRow` (as `number|null`/`string|null`) and to `rowToChannel`. `CreateChannelRecord` gets `createdByMemberId: number`; INSERT adds column `createdByMemberId` + param. `setChannelStatus(userId, id, status, changedByMemberId: number)`:
```ts
    `UPDATE channels
        SET status = ?, statusChangedByMemberId = ?, statusChangedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND userId = ?`,
    [status, changedByMemberId, id, userId]
```
The two call sites (`api/channels/route.ts` POST, `api/channels/[id]/route.ts` PATCH) will be updated in Task 5; until then `npx tsc --noEmit` is expected to fail there — that is fine within this task, but finish Task 5 before pushing.

- [ ] **Step 4: Verify migration on a throwaway local DB** (prod vars blanked):

```bash
rm -rf data && mkdir data && node -e "
const {createClient}=require('@libsql/client');const db=createClient({url:'file:data/app.db'});
(async()=>{await db.executeMultiple(\`
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT, image TEXT, createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, name TEXT NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(userId,name));
CREATE TABLE concepts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, name TEXT NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(userId,name));
CREATE TABLE channels (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, youtubeId TEXT NOT NULL, url TEXT NOT NULL, name TEXT NOT NULL, thumbnailUrl TEXT NOT NULL, subscriberCount INTEGER, videoCount INTEGER, viewCount INTEGER, categoryId INTEGER, conceptId INTEGER, languages TEXT NOT NULL DEFAULT '[]', countries TEXT NOT NULL DEFAULT '[]', notes TEXT, lastRefreshedAt TEXT, createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), publishDays TEXT NOT NULL DEFAULT '[]', publishTime TEXT, isActive INTEGER NOT NULL DEFAULT 1, categoryIds TEXT NOT NULL DEFAULT '[]', conceptIds TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', UNIQUE(userId, youtubeId));
INSERT INTO users (id,email,name) VALUES (1,'a@a.a','Ali'),(2,'b@b.b',NULL);
INSERT INTO channels (id,userId,youtubeId,url,name,thumbnailUrl) VALUES (1,1,'UC1','u','A','t'),(2,2,'UC2','u','B','t');\`);console.log('seeded')})()"
(TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx next dev -p 3131 > /tmp/dev.log 2>&1 &); sleep 15; curl -s -o /dev/null http://localhost:3131/sign-in
node -e "const {createClient}=require('@libsql/client');const db=createClient({url:'file:data/app.db'});(async()=>{console.log((await db.execute('SELECT id,userId,role,displayName FROM members')).rows);console.log((await db.execute('SELECT id,userId,createdByMemberId FROM channels')).rows)})()"
```
Expected: members `[{1,1,yonetici,Ali},{2,2,yonetici,b@b.b}]`; channels createdByMemberId `1` and `2`. Kill the server (`netstat -ano | grep :3131` → `taskkill //PID <pid> //F`), `rm -rf data`.

- [ ] **Step 5: Commit** `Üye tablosu, kanal ekleyen/durum değiştiren sütunları ve migration`.

---

### Task 4: Auth — Credentials provider, session actor, server guards

**Files:**
- Modify: `src/types/next-auth.d.ts`, `src/lib/auth.ts`
- Create: `src/lib/authz.ts`
- Modify: `src/lib/validation.ts` (username/password rules used by login + team)

**Interfaces:**
- Produces: `session.member: { id: number; role: MemberRole; displayName: string }`; `getSessionActor(): Promise<Actor | null>` where `Actor = { workspaceId: number; memberId: number; role: MemberRole; displayName: string }`; `requireActor()` → `Actor | Response(401)`; `requirePermission(permission)` → `Actor | Response(401/403)`; `requirePageRole(permission)` (server components: redirects to `/` when denied, `/sign-in` when logged out).
- Validation: `USERNAME_RE = /^[a-z0-9._-]{3,30}$/`, `usernameSchema`, `passwordSchema` (min 8), `staffLoginSchema`.

- [ ] **Step 1: Types**

`src/types/next-auth.d.ts`:
```ts
import type { DefaultSession } from "next-auth";
import type { MemberRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    member: { id: number; role: MemberRole; displayName: string };
  }
  interface User {
    /** Set by the Credentials provider so the jwt callback can attribute the workspace. */
    workspaceId?: number;
    memberId?: number;
    role?: MemberRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    memberId?: number;
    role?: MemberRole;
    displayName?: string;
  }
}
```

- [ ] **Step 2: Validation additions** (`src/lib/validation.ts`):
```ts
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "Kullanıcı adı 3-30 karakter olmalı; küçük harf, rakam, nokta, alt çizgi ve tire kullanılabilir");
export const passwordSchema = z.string().min(8, "Şifre en az 8 karakter olmalı");
export const staffLoginSchema = z.object({ username: usernameSchema, password: z.string().min(1) });
```

- [ ] **Step 3: `src/lib/auth.ts`** — replace the NextAuth config:

```ts
import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getOrCreateUserByEmail, getUserById } from "@/lib/db/users";
import { ensureTrialSubscription } from "@/lib/db/subscriptions";
import { ensureOwnerMember, getMemberById, getMemberByUsername, touchMemberLogin } from "@/lib/db/members";
import { verifyPassword } from "@/lib/password";
import { hasActiveAccess } from "@/lib/access";
import { staffLoginSchema } from "@/lib/validation";
import type { MemberRole } from "@/lib/roles";

export interface Actor {
  workspaceId: number;
  memberId: number;
  role: MemberRole;
  displayName: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
    Credentials({
      id: "staff",
      name: "Personel",
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = staffLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const member = await getMemberByUsername(parsed.data.username);
        if (!member?.passwordHash) return null;
        if (!(await verifyPassword(parsed.data.password, member.passwordHash))) return null;
        if (member.status !== "active") throw new Error("DISABLED");
        if (!(await hasActiveAccess(member.userId))) throw new Error("NO_ACCESS");
        await touchMemberLogin(member.id);
        // `id` must be a string for NextAuth; the workspace/member ids ride along for the jwt callback.
        return { id: String(member.userId), name: member.displayName, workspaceId: member.userId, memberId: member.id, role: member.role };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "staff") return true;
      return Boolean(user.email);
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "staff" && user.workspaceId && user.memberId && user.role) {
        token.userId = user.workspaceId;
        token.memberId = user.memberId;
        token.role = user.role;
        token.displayName = user.name ?? "";
        return token;
      }
      if (user?.email) {
        const dbUser = await getOrCreateUserByEmail(user.email, user.name ?? null, user.image ?? null);
        await ensureTrialSubscription(dbUser.id);
        const owner = await ensureOwnerMember(dbUser.id, dbUser.name ?? dbUser.email);
        token.userId = dbUser.id;
        token.memberId = owner.id;
        token.role = "yonetici";
        token.displayName = owner.displayName;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = Number(token.userId);
      if (session.user && userId) {
        session.user.id = String(userId);
        if (token.role === "yonetici") {
          const dbUser = await getUserById(userId);
          if (dbUser) {
            session.user.name = dbUser.name;
            session.user.image = dbUser.image;
          }
        } else {
          const member = token.memberId ? await getMemberById(token.memberId) : undefined;
          session.user.name = member?.displayName ?? token.displayName ?? null;
          session.user.image = null;
        }
        session.member = {
          id: Number(token.memberId),
          role: (token.role ?? "yonetici") as MemberRole,
          displayName: session.user.name ?? "",
        };
      }
      return session;
    },
  },
});

export async function getSessionUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

export async function getSessionActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id || !session.member?.id) return null;
  return {
    workspaceId: Number(session.user.id),
    memberId: session.member.id,
    role: session.member.role,
    displayName: session.member.displayName,
  };
}
```
Note: a disabled member whose token is still valid keeps working until the JWT expires (default 30 days). To close that hole cheaply, in the `session` callback for non-owners: `if (member?.status !== "active") return { ...session, user: { ...session.user, id: "" } }` so `getSessionUserId()` returns null and every page redirects to sign-in. Implement this.

- [ ] **Step 4: `src/lib/authz.ts`**

```ts
import "server-only";
import { redirect } from "next/navigation";
import { errorResponse } from "@/lib/http";
import { getSessionActor, type Actor } from "@/lib/auth";
import { can, type Permission } from "@/lib/roles";

export async function requireActor(): Promise<Actor | Response> {
  const actor = await getSessionActor();
  return actor ?? errorResponse(401, "Unauthorized");
}

/** API guard: 401 when logged out, 403 when the role lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Actor | Response> {
  const actor = await getSessionActor();
  if (!actor) return errorResponse(401, "Unauthorized");
  if (!can(actor.role, permission)) return errorResponse(403, "Bu işlem için yetkiniz yok");
  return actor;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

/** Page guard for server components: bounce to /sign-in when logged out, to / when not allowed. */
export async function requirePageRole(permission: Permission): Promise<Actor> {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in");
  if (!can(actor.role, permission)) redirect("/");
  return actor;
}
```

- [ ] **Step 5: `npx tsc --noEmit`** — only the two channel call-site errors from Task 3 may remain. Commit: `Personel girişi (Credentials) ve oturum aktörü`.

---

### Task 5: Enforce permissions + attribution in API routes

**Files:**
- Modify: `src/app/api/channels/route.ts` (POST), `src/app/api/channels/[id]/route.ts` (PATCH, DELETE), `src/app/api/channels/[id]/refresh/route.ts` (POST), `src/app/api/categories/route.ts` (POST), `src/app/api/categories/[id]/route.ts` (PATCH, DELETE), `src/app/api/concepts/route.ts` (POST), `src/app/api/concepts/[id]/route.ts` (PATCH, DELETE), `src/app/api/schedule/route.ts` (POST), `src/app/api/schedule/[id]/route.ts` (DELETE), `src/app/api/channel-month-patterns/route.ts` (POST), `src/app/api/profile/route.ts` (PATCH), `src/app/api/profile/avatar/route.ts` (POST)

Pattern for every write handler — replace
```ts
  const userId = await getSessionUserId();
  if (!userId) return errorResponse(401, "Unauthorized");
```
with
```ts
  const actor = await requirePermission("channel.write"); // permission per route, see table
  if (isResponse(actor)) return actor;
  const userId = actor.workspaceId;
```
GET handlers stay on `getSessionUserId()` (read is open to all roles).

| Route | Permission |
|---|---|
| channels POST, channels/[id] PATCH, channels/[id]/refresh POST | `channel.write` |
| channels/[id] DELETE | `channel.delete` |
| categories POST/PATCH/DELETE, concepts POST/PATCH/DELETE | `taxonomy.write` |
| schedule POST, schedule/[id] DELETE, channel-month-patterns POST | `schedule.write` |
| profile PATCH, profile/avatar POST | `billing.view` (owner-only areas) |

Attribution:
- channels POST → `createChannel(userId, { ..., createdByMemberId: actor.memberId })`.
- channels/[id] PATCH → `setChannelStatus(userId, channelId, status, actor.memberId)`.

- [ ] **Step 1: Apply the pattern to every route in the table** (import `requirePermission, isResponse` from `@/lib/authz`; drop unused `getSessionUserId` imports where no GET remains).
- [ ] **Step 2: `npx tsc --noEmit` and `npx eslint src/app/api`** → clean.
- [ ] **Step 3: Commit** `API yazma uçlarında rol kontrolü ve kanal ekleyen/durum değiştiren kaydı`.

---

### Task 6: Client-side actor hook + hide disallowed actions

**Files:**
- Create: `src/lib/useActor.ts`
- Modify: `src/components/ChannelCard.tsx`, `src/components/ChannelListRow.tsx`, `src/app/channels/(hub)/HubAddButton.tsx`, `src/app/channels/(hub)/categories/CategoriesClient.tsx`, `src/app/channels/(hub)/concepts/ConceptsClient.tsx`, `src/app/calendar/CalendarClient.tsx`, `src/app/calendar/page.tsx`, `src/components/Nav.tsx`

**Interfaces:**
- Produces: `useActor(): { role: MemberRole | null; can: (p: Permission) => boolean; displayName: string }` (client; `role` null while session loads → `can` returns false so buttons appear only once the role is known).

- [ ] **Step 1: `src/lib/useActor.ts`**
```ts
"use client";

import { useSession } from "next-auth/react";
import { can as canRole, type MemberRole, type Permission } from "@/lib/roles";

export function useActor() {
  const { data } = useSession();
  const role: MemberRole | null = data?.member?.role ?? null;
  return {
    role,
    displayName: data?.member?.displayName ?? "",
    can: (permission: Permission) => (role ? canRole(role, permission) : false),
  };
}
```

- [ ] **Step 2: Cards & rows.** In both files add `const { can } = useActor();` and wrap: the Yenile button, the pencil `Link`, and the eye toggle in `{can("channel.write") && (...)}`; the trash button in `{can("channel.delete") && (...)}`. Keep "Detayları Gör", Özelleştir, Videolar visible for everyone.
- [ ] **Step 3: Hub add button.** `HubAddButton` returns `null` unless `can("channel.write")`.
- [ ] **Step 4: Categories/Concepts.** Wrap the "Kategori Ekle"/"Konsept Ekle" button and each row's pencil + trash in `{can("taxonomy.write") && ...}`.
- [ ] **Step 5: Calendar read-only.** `CalendarClient` gets `readOnly: boolean` prop (page passes `!can(actor.role, "schedule.write")` computed server-side via `getSessionActor()`). When `readOnly`: `toggleChannelDay`, `setActiveSlot(...)` click handlers, `openContextMenu`, `quickSetStatus`, `saveEntry`, `removeEntry` return early; the "+" per-day buttons and the "Kanal Yayın Günleri" panel's toggles are not rendered; slots render as plain `div`s (no `cursor-pointer`). Implement by adding `if (readOnly) return;` at the top of each handler and `{!readOnly && (...)}` around the "+" buttons and pattern toggles.
- [ ] **Step 6: Nav.** Build `links` inside the component from role: always Dashboard, Kanallar, Takvim; add `{ href: "/team", label: "Personel", icon: Users }` and `{ href: "/billing", label: "Üyelik", icon: CreditCard }` only when `role === "yonetici"`. Account link: owner → `/profile` (avatar as today); staff → `/account` with the initial-letter circle. Same in the mobile menu.
- [ ] **Step 7:** `npx tsc --noEmit`, `npx eslint src` clean. Commit: `Rol bazlı buton/menü görünürlüğü ve salt-okunur takvim`.

---

### Task 7: Staff sign-in form

**Files:**
- Create: `src/app/sign-in/StaffSignInForm.tsx`
- Modify: `src/app/sign-in/page.tsx` (render the form under the Google CTA block)

- [ ] **Step 1: Component**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Staff accounts (created by the workspace owner on /team) sign in here; the owner uses Google.
export function StaffSignInForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("staff", { username, password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      // NextAuth flattens authorize() errors to a code; map the two we throw, default to the generic copy.
      setError(
        res.code === "DISABLED"
          ? "Hesabınız pasif, yöneticinize başvurun"
          : res.code === "NO_ACCESS"
            ? "Çalışma alanının üyeliği sona ermiş. Yöneticinize başvurun."
            : "Kullanıcı adı veya şifre hatalı"
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <KeyRound className="h-4 w-4" /> Personel girişi
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-scale-in mt-2 w-full max-w-sm space-y-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Personel girişi</p>
      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı" autoComplete="username" required />
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" autoComplete="current-password" required />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Vazgeç</Button>
        <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Giriş yapılıyor..." : "Giriş yap"}</Button>
      </div>
    </form>
  );
}
```
NextAuth v5: to surface `code`, throw `class StaffAuthError extends CredentialsSignin { code = "DISABLED" }` subclasses from `authorize()` instead of plain `Error` — define `DisabledError` / `NoAccessError` extending `CredentialsSignin` (import from `next-auth`) in `auth.ts` and throw those. Verify the `res.code` value in the browser; if it arrives as `res.error === "CredentialsSignin"` only, fall back to the generic message.

- [ ] **Step 2: Mount** in `src/app/sign-in/page.tsx` right after the `<p className="text-xs text-ink-faint">Ücretsiz deneyin...</p>` line's parent `div` closes: `<div className="mt-4"><StaffSignInForm /></div>`.
- [ ] **Step 3:** build clean. Commit: `Giriş sayfasına personel girişi formu`.

---

### Task 8: `/team` page + member APIs (owner only)

**Files:**
- Create: `src/app/api/team/route.ts` (GET list, POST create), `src/app/api/team/[id]/route.ts` (PATCH), `src/app/api/team/[id]/password/route.ts` (POST)
- Create: `src/app/team/page.tsx`, `src/app/team/TeamClient.tsx`, `src/app/team/loading.tsx` (copy of `src/app/channels/loading.tsx`)
- Modify: `src/lib/validation.ts` (schemas)

**Interfaces:**
- Validation: `createMemberSchema = z.object({ displayName: z.string().trim().min(1,"Ad gerekli").max(60), username: usernameSchema, password: passwordSchema, role: z.enum(["vekil","duzenleyici","goruntuleyici"]) })`; `updateMemberSchema = z.object({ displayName: ...optional, role: z.enum([...]).optional(), status: z.enum(["active","disabled"]).optional() })`; `setMemberPasswordSchema = z.object({ password: passwordSchema })`.
- API responses return `Member` (never the hash).

- [ ] **Step 1: APIs** — each starts with `const actor = await requirePermission("team.manage"); if (isResponse(actor)) return actor;`.
  - POST `/api/team`: parse → `if (await isUsernameTaken(username)) return errorResponse(409, "Bu kullanıcı adı kullanımda")` → `createMember(actor.workspaceId, { ..., passwordHash: await hashPassword(password) })` → 201.
  - PATCH `/api/team/[id]`: load `getMemberById`, 404 if missing or `member.userId !== actor.workspaceId`; refuse changing the owner row (`member.role === "yonetici"` → 400 `"Yönetici hesabı düzenlenemez"`); `updateMember`.
  - POST `/api/team/[id]/password`: same ownership checks; `setMemberPasswordHash(..., await hashPassword(password))` → 204.
- [ ] **Step 2: Page** `src/app/team/page.tsx`: `const actor = await requirePageRole("team.manage");` → `listMembers(actor.workspaceId)` → `<TeamClient initialMembers={members} />`.
- [ ] **Step 3: `TeamClient`** (client): header "Personel" + "Personel Ekle" button toggling an inline form (görünen ad, kullanıcı adı, şifre, rol `<Select>` from `STAFF_ROLES` with `ROLE_LABELS`); table/cards: ad, `@username`, rol rozeti (`CategoryBadge` reuse with fixed colors: vekil `#F59E0B`, duzenleyici `#3B82F6`, goruntuleyici `#6B7280`, yonetici `#EF4444`), durum, son giriş (`formatRelativeTime` or "—"); row actions for non-owner rows: Düzenle (ad + rol inline), Şifre sıfırla (prompt-less inline input + Kaydet), Pasife al / Aktife al (`ConfirmDialog` for pasife). Owner row shows "Siz" and no actions. All mutations via `fetch` + `toast`, state updated from the returned `Member`.
- [ ] **Step 4:** build clean. Commit: `Personel sayfası ve üye API'leri`.

---

### Task 9: `/account` page for staff + owner-only page guards

**Files:**
- Create: `src/app/api/account/route.ts` (PATCH displayName), `src/app/api/account/password/route.ts` (POST {currentPassword,newPassword})
- Create: `src/app/account/page.tsx`, `src/app/account/AccountClient.tsx`
- Modify: `src/app/profile/page.tsx`, `src/app/billing/page.tsx`, `src/lib/validation.ts`

- [ ] **Step 1: Validation** `updateAccountSchema = z.object({ displayName: z.string().trim().min(1).max(60) })`, `changeOwnPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema })`.
- [ ] **Step 2: APIs** (any logged-in staff; owner gets 400 `"Yönetici için profil sayfasını kullanın"` since the owner has no password): `requireActor()`; PATCH → `updateMember(actor.workspaceId, actor.memberId, { displayName })`; password → load `getMemberByUsername` via `getMemberById` + a new `getMemberPasswordHash(id)` in members.ts (`SELECT passwordHash FROM members WHERE id = ?`), `verifyPassword(currentPassword, hash)` else 400 `"Mevcut şifre hatalı"`, then `setMemberPasswordHash`.
- [ ] **Step 3: Page** `/account`: `getSessionActor()`; if `role === "yonetici"` → `redirect("/profile")`; render `AccountClient` with displayName + username + role label; two small forms (ad; mevcut şifre / yeni şifre / yeni şifre tekrar with client-side match check). After a successful name change call `router.refresh()` so the Nav initial updates.
- [ ] **Step 4: Guards** — `src/app/profile/page.tsx` and `src/app/billing/page.tsx`: replace the `getSessionUserId` + redirect lines with `const actor = await requirePageRole("billing.view"); const userId = actor.workspaceId;`.
- [ ] **Step 5:** build clean. Commit: `Personel hesabım sayfası ve yönetici sayfalarına rol koruması`.

---

### Task 10: Channel detail attribution

**Files:**
- Modify: `src/app/channels/[id]/page.tsx`

- [ ] **Step 1:** Load `listMembers(userId)` alongside the existing `Promise.all` and build `const memberName = (id: number | null) => members.find((m) => m.id === id)?.displayName ?? "—";`.
- [ ] **Step 2:** Under the badges row in the header card add:
```tsx
<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
  <span>Ekleyen: <span className="text-ink">{memberName(channel.createdByMemberId)}</span> · {formatDate(channel.createdAt)}</span>
  {channel.statusChangedAt && (
    <span>
      {channel.status === "passive" ? "Pasife alan" : channel.status === "active" ? "Aktife alan" : "Son durum değişikliği"}:{" "}
      <span className="text-ink">{memberName(channel.statusChangedByMemberId)}</span> · {formatDate(channel.statusChangedAt)}
    </span>
  )}
</div>
```
(`formatDate` from `@/lib/format`.)
- [ ] **Step 3:** build clean. Commit: `Kanal detayında ekleyen ve durumu değiştiren bilgisi`.

---

### Task 11: Deploy + live verification

- [ ] **Step 1:** `npm test`, `npx tsc --noEmit`, `npx eslint src`, `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= npx next build` all clean. `git push origin main`; wait for `npx vercel ls --yes` → Ready; hit `/sign-in` once to run the migration; read-only check that `members` has one `yonetici` per user and `channels.createdByMemberId` is filled for all 15+ channels.
- [ ] **Step 2 (browser, as owner):** `/team` → create a `goruntuleyici` test member (`test.viewer` / a throwaway password). Confirm `/channels/[id]` shows "Ekleyen: <owner name>".
- [ ] **Step 3 (browser, incognito):** sign in as the viewer → no "Kanal Ekle", no pencil/eye/trash, `/billing` and `/team` redirect to `/`, calendar cells inert. Directly `fetch("/api/channels", {method:"POST"...})` from devtools → 403 `Bu işlem için yetkiniz yok`.
- [ ] **Step 4:** Change the test member to `duzenleyici` on `/team`; the viewer's next page load (JWT still valid — role is read from token) still shows the old role until re-login: document this in the /team UI as a hint "Rol değişikliği personel yeniden giriş yapınca geçerli olur" (add the hint text under the role select in Task 8's form if not already there).
- [ ] **Step 5:** Disable the test member; confirm their session bounces to `/sign-in`. Report results to the user with screenshots.

## Self-review notes
- Spec coverage: roles/matrix (T2, T5, T6), members table + backfill (T3), credentials login + JWT shape (T4, T7), /team (T8), /account + owner-only guards (T9), channel attribution (T10), delete restriction (T5/T6), error copy (T4/T5/T7/T8), verification (T11). Not covered by design: member delete (out of scope), staff plan limits (deferred).
- Known limitation carried into the UI hint: role/status changes take effect on the staff member's next login (JWT), except `disabled`, which the session callback enforces on every request.
