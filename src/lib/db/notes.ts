import "server-only";
import { all, get, run } from "@/lib/db";
import type { Note } from "@/types";

interface NoteRow {
  id: number;
  memberId: number;
  title: string;
  body: string;
  pinned: number;
  createdAt: string;
  updatedAt: string;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    memberId: row.memberId,
    title: row.title,
    body: row.body,
    pinned: row.pinned === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const NOTE_COLUMNS = "id, memberId, title, body, pinned, createdAt, updatedAt";

/** Pinned first, then most recently updated — matches the /notes list order. */
export async function listNotes(userId: number, memberId: number): Promise<Note[]> {
  const rows = await all<NoteRow>(
    `SELECT ${NOTE_COLUMNS} FROM notes WHERE userId = ? AND memberId = ? ORDER BY pinned DESC, updatedAt DESC`,
    [userId, memberId]
  );
  return rows.map(rowToNote);
}

export async function getNoteById(userId: number, id: number): Promise<Note | undefined> {
  const row = await get<NoteRow>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ? AND userId = ?`, [id, userId]);
  return row ? rowToNote(row) : undefined;
}

export interface CreateNoteInput {
  title: string;
  body: string;
}

export async function createNote(userId: number, memberId: number, input: CreateNoteInput): Promise<Note> {
  const result = await run(`INSERT INTO notes (userId, memberId, title, body) VALUES (?, ?, ?, ?)`, [
    userId,
    memberId,
    input.title,
    input.body,
  ]);
  return (await getNoteById(userId, result.lastInsertRowid))!;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  pinned?: boolean;
}

export async function updateNote(userId: number, id: number, patch: UpdateNoteInput): Promise<Note> {
  const existing = await getNoteById(userId, id);
  if (!existing) throw new Error("Not bulunamadı");

  const title = patch.title ?? existing.title;
  const body = patch.body ?? existing.body;
  const pinned = patch.pinned ?? existing.pinned;

  await run(
    `UPDATE notes SET title = ?, body = ?, pinned = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND userId = ?`,
    [title, body, pinned ? 1 : 0, id, userId]
  );

  return (await getNoteById(userId, id))!;
}

export async function deleteNote(userId: number, id: number): Promise<void> {
  await run(`DELETE FROM notes WHERE id = ? AND userId = ?`, [id, userId]);
}
