import "server-only";
import { all, get, run } from "@/lib/db";
import type { Concept, CreateConceptInput, UpdateConceptInput } from "@/types";

interface ConceptRow {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

function rowToConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export async function listConcepts(userId: number): Promise<Concept[]> {
  const rows = await all<ConceptRow>(
    `SELECT * FROM concepts WHERE userId = ? ORDER BY name COLLATE NOCASE ASC`,
    [userId]
  );
  return rows.map(rowToConcept);
}

export async function getConceptById(userId: number, id: number): Promise<Concept | undefined> {
  const row = await get<ConceptRow>(`SELECT * FROM concepts WHERE id = ? AND userId = ?`, [
    id,
    userId,
  ]);
  return row ? rowToConcept(row) : undefined;
}

export async function createConcept(userId: number, input: CreateConceptInput): Promise<Concept> {
  const result = await run(`INSERT INTO concepts (userId, name, color) VALUES (?, ?, ?)`, [
    userId,
    input.name,
    input.color,
  ]);
  return (await getConceptById(userId, result.lastInsertRowid))!;
}

export async function updateConcept(
  userId: number,
  id: number,
  input: UpdateConceptInput
): Promise<Concept> {
  const existing = await getConceptById(userId, id);
  if (!existing) {
    throw new Error(`Concept ${id} not found`);
  }
  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color;
  await run(`UPDATE concepts SET name = ?, color = ? WHERE id = ? AND userId = ?`, [
    name,
    color,
    id,
    userId,
  ]);
  return (await getConceptById(userId, id))!;
}

export async function deleteConcept(userId: number, id: number): Promise<void> {
  await run(`UPDATE channels SET conceptId = NULL WHERE conceptId = ? AND userId = ?`, [
    id,
    userId,
  ]);
  await run(`DELETE FROM concepts WHERE id = ? AND userId = ?`, [id, userId]);
}

export async function countChannelsByConcept(userId: number): Promise<Record<number, number>> {
  const rows = await all<{ conceptId: number; count: number }>(
    `SELECT conceptId, COUNT(*) as count FROM channels WHERE conceptId IS NOT NULL AND userId = ? GROUP BY conceptId`,
    [userId]
  );
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.conceptId] = row.count;
  }
  return result;
}
