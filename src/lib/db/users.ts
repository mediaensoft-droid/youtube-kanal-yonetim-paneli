import "server-only";
import { all, get, run } from "@/lib/db";

export interface AppUser {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
}

export async function getUserByEmail(email: string): Promise<AppUser | undefined> {
  return get<AppUser>(`SELECT * FROM users WHERE email = ?`, [email]);
}

export async function getUserById(id: number): Promise<AppUser | undefined> {
  return get<AppUser>(`SELECT * FROM users WHERE id = ?`, [id]);
}

// Google's name/photo only seed the profile at account creation — once a user exists, their
// name/image are app-owned (editable on /profile) and never get silently overwritten by
// whatever Google happens to report on a later sign-in.
export async function getOrCreateUserByEmail(
  email: string,
  name: string | null,
  image: string | null
): Promise<AppUser> {
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  const result = await run(`INSERT INTO users (email, name, image) VALUES (?, ?, ?)`, [
    email,
    name,
    image,
  ]);
  return (await get<AppUser>(`SELECT * FROM users WHERE id = ?`, [result.lastInsertRowid]))!;
}

export interface UserProfileUpdate {
  name?: string | null;
  image?: string | null;
}

export async function updateUserProfile(id: number, input: UserProfileUpdate): Promise<AppUser> {
  const existing = await getUserById(id);
  if (!existing) throw new Error("Kullanıcı bulunamadı");

  const name = input.name !== undefined ? input.name : existing.name;
  const image = input.image !== undefined ? input.image : existing.image;

  await run(`UPDATE users SET name = ?, image = ? WHERE id = ?`, [name, image, id]);
  return { ...existing, name, image };
}

export async function listAllUsers(): Promise<AppUser[]> {
  return all<AppUser>(`SELECT * FROM users ORDER BY createdAt ASC`);
}
