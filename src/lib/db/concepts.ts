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

export async function listConcepts(): Promise<Concept[]> {
  const rows = await all<ConceptRow>(`SELECT * FROM concepts ORDER BY name COLLATE NOCASE ASC`);
  return rows.map(rowToConcept);
}

export async function getConceptById(id: number): Promise<Concept | undefined> {
  const row = await get<ConceptRow>(`SELECT * FROM concepts WHERE id = ?`, [id]);
  return row ? rowToConcept(row) : undefined;
}

export async function createConcept(input: CreateConceptInput): Promise<Concept> {
  const result = await run(`INSERT INTO concepts (name, color) VALUES (?, ?)`, [
    input.name,
    input.color,
  ]);
  return (await getConceptById(result.lastInsertRowid))!;
}

export async function updateConcept(id: number, input: UpdateConceptInput): Promise<Concept> {
  const existing = await getConceptById(id);
  if (!existing) {
    throw new Error(`Concept ${id} not found`);
  }
  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color;
  await run(`UPDATE concepts SET name = ?, color = ? WHERE id = ?`, [name, color, id]);
  return (await getConceptById(id))!;
}

export async function deleteConcept(id: number): Promise<void> {
  await run(`UPDATE channels SET conceptId = NULL WHERE conceptId = ?`, [id]);
  await run(`DELETE FROM concepts WHERE id = ?`, [id]);
}

export async function countChannelsByConcept(): Promise<Record<number, number>> {
  const rows = await all<{ conceptId: number; count: number }>(
    `SELECT conceptId, COUNT(*) as count FROM channels WHERE conceptId IS NOT NULL GROUP BY conceptId`
  );
  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.conceptId] = row.count;
  }
  return result;
}
