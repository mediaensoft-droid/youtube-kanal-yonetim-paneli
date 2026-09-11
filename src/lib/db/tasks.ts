import "server-only";
import { all, get, run } from "@/lib/db";
import type { Task, TaskColumn, TaskComment, ChecklistItem, TaskPriority } from "@/types";

interface TaskColumnRow {
  id: number;
  name: string;
  position: number;
  isDone: number;
  createdAt: string;
}

function rowToColumn(row: TaskColumnRow): TaskColumn {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    isDone: row.isDone === 1,
    createdAt: row.createdAt,
  };
}

interface TaskRow {
  id: number;
  columnId: number;
  title: string;
  description: string | null;
  assigneeMemberId: number | null;
  channelId: number | null;
  dueDate: string | null;
  priority: TaskPriority;
  position: number;
  checklist: string;
  createdByMemberId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present when the query joins the comment-count subquery (see TASK_COLUMNS_WITH_COMMENTS). */
  commentCount?: number;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    columnId: row.columnId,
    title: row.title,
    description: row.description,
    assigneeMemberId: row.assigneeMemberId,
    channelId: row.channelId,
    dueDate: row.dueDate,
    priority: row.priority,
    position: row.position,
    checklist: JSON.parse(row.checklist) as ChecklistItem[],
    createdByMemberId: row.createdByMemberId,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    commentCount: row.commentCount ?? 0,
  };
}

interface TaskCommentRow {
  id: number;
  taskId: number;
  memberId: number | null;
  memberName: string | null;
  body: string;
  createdAt: string;
}

function rowToComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    memberId: row.memberId,
    memberName: row.memberName,
    body: row.body,
    createdAt: row.createdAt,
  };
}

const COLUMN_COLUMNS = "id, name, position, isDone, createdAt";
const TASK_COLUMNS =
  "id, columnId, title, description, assigneeMemberId, channelId, dueDate, priority, position, checklist, createdByMemberId, completedAt, createdAt, updatedAt";

// Grouped subquery keeps this a single round trip instead of N+1 comment-count lookups per task.
const TASK_COMMENT_COUNT_JOIN =
  "LEFT JOIN (SELECT taskId, COUNT(*) AS commentCount FROM task_comments GROUP BY taskId) tcc ON tcc.taskId = tasks.id";
const TASK_COLUMNS_WITH_COMMENTS = `${TASK_COLUMNS}, COALESCE(tcc.commentCount, 0) AS commentCount`;

const DEFAULT_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: "Yapılacak", isDone: false },
  { name: "Devam Ediyor", isDone: false },
  { name: "Tamamlandı", isDone: true },
];

/** First-visit bootstrap: creates the three default columns only if the workspace has none yet. */
export async function ensureDefaultColumns(userId: number): Promise<void> {
  const existing = await get<{ count: number }>(`SELECT COUNT(*) as count FROM task_columns WHERE userId = ?`, [
    userId,
  ]);
  if ((existing?.count ?? 0) > 0) return;

  for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
    const column = DEFAULT_COLUMNS[i];
    await run(`INSERT INTO task_columns (userId, name, position, isDone) VALUES (?, ?, ?, ?)`, [
      userId,
      column.name,
      i,
      column.isDone ? 1 : 0,
    ]);
  }
}

export interface Board {
  columns: TaskColumn[];
  tasks: Task[];
}

export async function listBoard(userId: number): Promise<Board> {
  const [columnRows, taskRows] = await Promise.all([
    all<TaskColumnRow>(`SELECT ${COLUMN_COLUMNS} FROM task_columns WHERE userId = ? ORDER BY position ASC`, [
      userId,
    ]),
    all<TaskRow>(
      `SELECT ${TASK_COLUMNS_WITH_COMMENTS} FROM tasks ${TASK_COMMENT_COUNT_JOIN} WHERE userId = ? ORDER BY position ASC`,
      [userId]
    ),
  ]);
  return { columns: columnRows.map(rowToColumn), tasks: taskRows.map(rowToTask) };
}

export async function getColumnById(userId: number, id: number): Promise<TaskColumn | undefined> {
  const row = await get<TaskColumnRow>(`SELECT ${COLUMN_COLUMNS} FROM task_columns WHERE id = ? AND userId = ?`, [
    id,
    userId,
  ]);
  return row ? rowToColumn(row) : undefined;
}

export async function createColumn(userId: number, name: string): Promise<TaskColumn> {
  const row = await get<{ maxPos: number | null }>(
    `SELECT MAX(position) as maxPos FROM task_columns WHERE userId = ?`,
    [userId]
  );
  const position = (row?.maxPos ?? -1) + 1;
  const result = await run(`INSERT INTO task_columns (userId, name, position, isDone) VALUES (?, ?, ?, 0)`, [
    userId,
    name,
    position,
  ]);
  return (await getColumnById(userId, result.lastInsertRowid))!;
}

export interface UpdateColumnInput {
  name?: string;
  position?: number;
}

export async function updateColumn(userId: number, id: number, patch: UpdateColumnInput): Promise<TaskColumn> {
  const existing = await getColumnById(userId, id);
  if (!existing) throw new Error("Sütun bulunamadı");

  if (patch.name !== undefined) {
    await run(`UPDATE task_columns SET name = ? WHERE id = ? AND userId = ?`, [patch.name, id, userId]);
  }

  if (patch.position !== undefined && patch.position !== existing.position) {
    const rows = await all<TaskColumnRow>(
      `SELECT ${COLUMN_COLUMNS} FROM task_columns WHERE userId = ? ORDER BY position ASC`,
      [userId]
    );
    const ordered = rows.map(rowToColumn).filter((c) => c.id !== id);
    const targetIndex = Math.max(0, Math.min(patch.position, ordered.length));
    ordered.splice(targetIndex, 0, { ...existing, name: patch.name ?? existing.name });
    for (let i = 0; i < ordered.length; i++) {
      await run(`UPDATE task_columns SET position = ? WHERE id = ? AND userId = ?`, [i, ordered[i].id, userId]);
    }
  }

  return (await getColumnById(userId, id))!;
}

export async function deleteColumn(userId: number, id: number): Promise<void> {
  const existing = await getColumnById(userId, id);
  if (!existing) throw new Error("Sütun bulunamadı");

  if (existing.isDone) {
    const doneCount = await get<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_columns WHERE userId = ? AND isDone = 1`,
      [userId]
    );
    if ((doneCount?.count ?? 0) <= 1) {
      throw new Error("Tamamlandı sütunu silinemez");
    }
  }

  const remaining = await all<TaskColumnRow>(
    `SELECT ${COLUMN_COLUMNS} FROM task_columns WHERE userId = ? AND id != ? ORDER BY position ASC`,
    [userId, id]
  );
  if (remaining.length === 0) {
    // Shouldn't happen in practice (there's always >=1 isDone column left), but guard anyway.
    throw new Error("Son sütun silinemez");
  }

  // Move this column's tasks into the lowest-position remaining column, appended at the end.
  const target = remaining[0];
  const targetIsDone = target.isDone === 1;

  const maxPosRow = await get<{ maxPos: number | null }>(
    `SELECT MAX(position) as maxPos FROM tasks WHERE userId = ? AND columnId = ?`,
    [userId, target.id]
  );
  let nextPosition = (maxPosRow?.maxPos ?? -1) + 1;

  const tasksToMove = await all<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE userId = ? AND columnId = ? ORDER BY position ASC`,
    [userId, id]
  );
  for (const t of tasksToMove) {
    const completedAt = targetIsDone ? (t.completedAt ?? new Date().toISOString()) : null;
    await run(
      `UPDATE tasks
          SET columnId = ?, position = ?, completedAt = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ? AND userId = ?`,
      [target.id, nextPosition, completedAt, t.id, userId]
    );
    nextPosition += 1;
  }

  await run(`DELETE FROM task_columns WHERE id = ? AND userId = ?`, [id, userId]);

  // Re-sequence the surviving columns so positions stay contiguous (0..n-1).
  for (let i = 0; i < remaining.length; i++) {
    await run(`UPDATE task_columns SET position = ? WHERE id = ? AND userId = ?`, [i, remaining[i].id, userId]);
  }
}

export async function getTaskById(userId: number, id: number): Promise<Task | undefined> {
  const row = await get<TaskRow>(
    `SELECT ${TASK_COLUMNS_WITH_COMMENTS} FROM tasks ${TASK_COMMENT_COUNT_JOIN} WHERE id = ? AND userId = ?`,
    [id, userId]
  );
  return row ? rowToTask(row) : undefined;
}

export interface CreateTaskInput {
  columnId: number;
  title: string;
  description?: string | null;
  assigneeMemberId?: number | null;
  channelId?: number | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  checklist?: ChecklistItem[];
  createdByMemberId: number;
}

export async function createTask(userId: number, input: CreateTaskInput): Promise<Task> {
  const column = await getColumnById(userId, input.columnId);
  if (!column) throw new Error("Sütun bulunamadı");

  const maxPosRow = await get<{ maxPos: number | null }>(
    `SELECT MAX(position) as maxPos FROM tasks WHERE userId = ? AND columnId = ?`,
    [userId, input.columnId]
  );
  const position = (maxPosRow?.maxPos ?? -1) + 1;
  const completedAt = column.isDone ? new Date().toISOString() : null;
  const checklist = input.checklist ?? [];

  const result = await run(
    `INSERT INTO tasks
      (userId, columnId, title, description, assigneeMemberId, channelId, dueDate, priority, position, checklist, createdByMemberId, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.columnId,
      input.title,
      input.description ?? null,
      input.assigneeMemberId ?? null,
      input.channelId ?? null,
      input.dueDate ?? null,
      input.priority ?? "normal",
      position,
      JSON.stringify(checklist),
      input.createdByMemberId,
      completedAt,
    ]
  );
  return (await getTaskById(userId, result.lastInsertRowid))!;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeMemberId?: number | null;
  channelId?: number | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  checklist?: ChecklistItem[];
}

export async function updateTask(userId: number, id: number, patch: UpdateTaskInput): Promise<Task> {
  const existing = await getTaskById(userId, id);
  if (!existing) throw new Error("Görev bulunamadı");

  const title = patch.title ?? existing.title;
  const description = patch.description !== undefined ? patch.description : existing.description;
  const assigneeMemberId =
    patch.assigneeMemberId !== undefined ? patch.assigneeMemberId : existing.assigneeMemberId;
  const channelId = patch.channelId !== undefined ? patch.channelId : existing.channelId;
  const dueDate = patch.dueDate !== undefined ? patch.dueDate : existing.dueDate;
  const priority = patch.priority ?? existing.priority;
  const checklist = patch.checklist !== undefined ? patch.checklist : existing.checklist;

  await run(
    `UPDATE tasks
        SET title = ?, description = ?, assigneeMemberId = ?, channelId = ?, dueDate = ?, priority = ?, checklist = ?,
            updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND userId = ?`,
    [title, description, assigneeMemberId, channelId, dueDate, priority, JSON.stringify(checklist), id, userId]
  );

  return (await getTaskById(userId, id))!;
}

export interface MoveTaskResult {
  task: Task;
  fromColumn: TaskColumn;
  toColumn: TaskColumn;
}

export async function moveTask(
  userId: number,
  id: number,
  columnId: number,
  position: number
): Promise<MoveTaskResult> {
  const existingTask = await getTaskById(userId, id);
  if (!existingTask) throw new Error("Görev bulunamadı");
  const fromColumn = await getColumnById(userId, existingTask.columnId);
  if (!fromColumn) throw new Error("Sütun bulunamadı");
  const toColumn = await getColumnById(userId, columnId);
  if (!toColumn) throw new Error("Sütun bulunamadı");

  if (existingTask.columnId === columnId) {
    // Reorder within the same column.
    const rows = await all<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE userId = ? AND columnId = ? ORDER BY position ASC`,
      [userId, columnId]
    );
    const ordered = rows.map(rowToTask).filter((t) => t.id !== id);
    const targetIndex = Math.max(0, Math.min(position, ordered.length));
    ordered.splice(targetIndex, 0, existingTask);
    for (let i = 0; i < ordered.length; i++) {
      await run(`UPDATE tasks SET position = ? WHERE id = ? AND userId = ?`, [i, ordered[i].id, userId]);
    }
  } else {
    // Remove from the old column & re-sequence it.
    const oldSiblings = await all<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE userId = ? AND columnId = ? AND id != ? ORDER BY position ASC`,
      [userId, existingTask.columnId, id]
    );
    for (let i = 0; i < oldSiblings.length; i++) {
      await run(`UPDATE tasks SET position = ? WHERE id = ? AND userId = ?`, [i, oldSiblings[i].id, userId]);
    }

    // Insert into the new column at `position` & re-sequence it, setting/clearing completedAt.
    const newSiblings = await all<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE userId = ? AND columnId = ? ORDER BY position ASC`,
      [userId, columnId]
    );
    const ordered = newSiblings.map(rowToTask);
    const targetIndex = Math.max(0, Math.min(position, ordered.length));
    ordered.splice(targetIndex, 0, existingTask);

    const completedAt = toColumn.isDone ? new Date().toISOString() : null;
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].id === id) {
        await run(
          `UPDATE tasks
              SET columnId = ?, position = ?, completedAt = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ? AND userId = ?`,
          [columnId, i, completedAt, id, userId]
        );
      } else {
        await run(`UPDATE tasks SET position = ? WHERE id = ? AND userId = ?`, [i, ordered[i].id, userId]);
      }
    }
  }

  const task = (await getTaskById(userId, id))!;
  return { task, fromColumn, toColumn };
}

export async function deleteTask(userId: number, id: number): Promise<void> {
  const existing = await getTaskById(userId, id);
  if (!existing) throw new Error("Görev bulunamadı");

  await run(`DELETE FROM tasks WHERE id = ? AND userId = ?`, [id, userId]);

  const siblings = await all<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE userId = ? AND columnId = ? ORDER BY position ASC`,
    [userId, existing.columnId]
  );
  for (let i = 0; i < siblings.length; i++) {
    await run(`UPDATE tasks SET position = ? WHERE id = ? AND userId = ?`, [i, siblings[i].id, userId]);
  }
}

export async function listComments(userId: number, taskId: number): Promise<TaskComment[]> {
  const rows = await all<TaskCommentRow>(
    `SELECT c.id, c.taskId, c.memberId, m.displayName AS memberName, c.body, c.createdAt
       FROM task_comments c
       JOIN tasks t ON t.id = c.taskId
       LEFT JOIN members m ON m.id = c.memberId
      WHERE c.taskId = ? AND t.userId = ?
      ORDER BY c.id ASC`,
    [taskId, userId]
  );
  return rows.map(rowToComment);
}

export async function addComment(userId: number, taskId: number, memberId: number, body: string): Promise<TaskComment> {
  const task = await getTaskById(userId, taskId);
  if (!task) throw new Error("Görev bulunamadı");

  const result = await run(`INSERT INTO task_comments (taskId, memberId, body) VALUES (?, ?, ?)`, [
    taskId,
    memberId,
    body,
  ]);
  const row = await get<TaskCommentRow>(
    `SELECT c.id, c.taskId, c.memberId, m.displayName AS memberName, c.body, c.createdAt
       FROM task_comments c
       LEFT JOIN members m ON m.id = c.memberId
      WHERE c.id = ?`,
    [result.lastInsertRowid]
  );
  return rowToComment(row!);
}

/** `to` is inclusive as a calendar day, matching listActivity/summarizeActivity semantics. */
function exclusiveUpperBound(toDate: string): string {
  const d = new Date(`${toDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface CountAssignedTasksOptions {
  from?: string;
  to?: string;
}

/** memberId -> count of tasks assigned to them and created in the given date range. */
export async function countAssignedTasks(
  userId: number,
  options: CountAssignedTasksOptions = {}
): Promise<Record<number, number>> {
  const conditions: string[] = [`userId = ?`, `assigneeMemberId IS NOT NULL`];
  const params: (string | number)[] = [userId];

  if (options.from) {
    conditions.push(`createdAt >= ?`);
    params.push(options.from);
  }
  if (options.to) {
    conditions.push(`createdAt < ?`);
    params.push(exclusiveUpperBound(options.to));
  }

  const rows = await all<{ assigneeMemberId: number; count: number }>(
    `SELECT assigneeMemberId, COUNT(*) as count
       FROM tasks
      WHERE ${conditions.join(" AND ")}
      GROUP BY assigneeMemberId`,
    params
  );

  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.assigneeMemberId] = row.count;
  }
  return result;
}
