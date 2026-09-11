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
