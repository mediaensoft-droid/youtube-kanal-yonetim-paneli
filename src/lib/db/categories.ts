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

export async function listCategories(): Promise<Category[]> {
  const rows = await all<CategoryRow>(`SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC`);
  return rows.map(rowToCategory);
}

export async function getCategoryById(id: number): Promise<Category | undefined> {
  const row = await get<CategoryRow>(`SELECT * FROM categories WHERE id = ?`, [id]);
  return row ? rowToCategory(row) : undefined;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const result = await run(`INSERT INTO categories (name, color) VALUES (?, ?)`, [
    input.name,
    input.color,
  ]);
  return (await getCategoryById(result.lastInsertRowid))!;
}

export async function updateCategory(id: number, input: UpdateCategoryInput): Promise<Category> {
  const existing = await getCategoryById(id);
  if (!existing) {
    throw new Error(`Category ${id} not found`);
  }
  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color;
  await run(`UPDATE categories SET name = ?, color = ? WHERE id = ?`, [name, color, id]);
  return (await getCategoryById(id))!;
}

export async function deleteCategory(id: number): Promise<void> {
  await run(`UPDATE channels SET categoryId = NULL WHERE categoryId = ?`, [id]);
  await run(`DELETE FROM categories WHERE id = ?`, [id]);
}

export async function countChannelsByCategory(): Promise<Record<number, number>> {
  const rows = await all<{ categoryId: number; count: number }>(
    `SELECT categoryId, COUNT(*) as count FROM channels WHERE categoryId IS NOT NULL GROUP BY categoryId`
  );
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.categoryId] = row.count;
  }
  return result;
}
