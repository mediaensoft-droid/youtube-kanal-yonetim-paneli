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

export async function getOrCreateUserByEmail(
  email: string,
  name: string | null,
  image: string | null
): Promise<AppUser> {
  const existing = await getUserByEmail(email);
  if (existing) {
    if (existing.name !== name || existing.image !== image) {
      await run(`UPDATE users SET name = ?, image = ? WHERE id = ?`, [name, image, existing.id]);
      return { ...existing, name, image };
    }
    return existing;
  }

  const result = await run(`INSERT INTO users (email, name, image) VALUES (?, ?, ?)`, [
    email,
    name,
    image,
  ]);
  return (await get<AppUser>(`SELECT * FROM users WHERE id = ?`, [result.lastInsertRowid]))!;
}

export async function listAllUsers(): Promise<AppUser[]> {
  return all<AppUser>(`SELECT * FROM users ORDER BY createdAt ASC`);
}
