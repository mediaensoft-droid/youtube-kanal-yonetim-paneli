import "server-only";
import { all, get, run } from "@/lib/db";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "@/types";

interface CategoryRow {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export async function listCategories(userId: number): Promise<Category[]> {
  const rows = await all<CategoryRow>(
    `SELECT * FROM categories WHERE userId = ? ORDER BY name COLLATE NOCASE ASC`,
    [userId]
  );
  return rows.map(rowToCategory);
}

export async function getCategoryById(userId: number, id: number): Promise<Category | undefined> {
  const row = await get<CategoryRow>(`SELECT * FROM categories WHERE id = ? AND userId = ?`, [
    id,
    userId,
  ]);
  return row ? rowToCategory(row) : undefined;
}

export async function createCategory(
  userId: number,
  input: CreateCategoryInput
): Promise<Category> {
  const result = await run(`INSERT INTO categories (userId, name, color) VALUES (?, ?, ?)`, [
    userId,
    input.name,
    input.color,
  ]);
  return (await getCategoryById(userId, result.lastInsertRowid))!;
}

export async function updateCategory(
  userId: number,
  id: number,
  input: UpdateCategoryInput
): Promise<Category> {
  const existing = await getCategoryById(userId, id);
  if (!existing) {
    throw new Error(`Category ${id} not found`);
  }
  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color;
  await run(`UPDATE categories SET name = ?, color = ? WHERE id = ? AND userId = ?`, [
    name,
    color,
    id,
    userId,
  ]);
  return (await getCategoryById(userId, id))!;
}

export async function deleteCategory(userId: number, id: number): Promise<void> {
  await run(`UPDATE channels SET categoryId = NULL WHERE categoryId = ? AND userId = ?`, [
    id,
    userId,
  ]);
  await run(`DELETE FROM categories WHERE id = ? AND userId = ?`, [id, userId]);
}

export async function countChannelsByCategory(userId: number): Promise<Record<number, number>> {
  const rows = await all<{ categoryId: number; count: number }>(
    `SELECT categoryId, COUNT(*) as count FROM channels WHERE categoryId IS NOT NULL AND userId = ? GROUP BY categoryId`,
    [userId]
  );
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.categoryId] = row.count;
  }
  return result;
}
