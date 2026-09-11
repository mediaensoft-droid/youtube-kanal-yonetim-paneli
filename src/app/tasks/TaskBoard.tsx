"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { Plus, X as XIcon, AlertCircle } from "lucide-react";
import type { Task, TaskColumn } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TaskCard } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { ColumnMenu } from "./ColumnMenu";

export interface BoardMember {
  id: number;
  displayName: string;
}

export interface BoardChannel {
  id: number;
  name: string;
  thumbnailUrl: string;
}

interface TaskBoardProps {
  initialColumns: TaskColumn[];
  initialTasks: Task[];
  members: BoardMember[];
  channels: BoardChannel[];
  readOnly: boolean;
  canDelete: boolean;
  currentMemberId: number;
}

interface DropTarget {
  columnId: number;
  /** Index among the column's visible (filtered) cards — where the indicator renders. */
  visibleIndex: number;
  /** Index in the column's full list (dragged task excluded) — what the API receives. */
  position: number;
}

function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Pure local reorder: moves `taskId` into `columnId` at `index`, re-sequencing positions in the
 * source and target columns exactly the way the server does, so the optimistic state matches
 * what the API will return.
 */
function moveInList(tasks: Task[], taskId: number, columnId: number, index: number): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;
  const others = tasks.filter((t) => t.id !== taskId);

  const target = sortByPosition(others.filter((t) => t.columnId === columnId));
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, { ...task, columnId });

  const source = task.columnId === columnId ? [] : sortByPosition(others.filter((t) => t.columnId === task.columnId));

  const touched = new Map<number, Task>();
  target.forEach((t, i) => touched.set(t.id, { ...t, position: i }));
  source.forEach((t, i) => touched.set(t.id, { ...t, position: i }));
  return tasks.map((t) => touched.get(t.id) ?? t);
}

function reorderColumns(columns: TaskColumn[], columnId: number, index: number): TaskColumn[] {
  const column = columns.find((c) => c.id === columnId);
  if (!column) return columns;
  const rest = sortByPosition(columns.filter((c) => c.id !== columnId));
  const clamped = Math.max(0, Math.min(index, rest.length));
  rest.splice(clamped, 0, column);
  return rest.map((c, i) => ({ ...c, position: i }));
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

export function TaskBoard({
  initialColumns,
  initialTasks,
  members,
  channels,
  readOnly,
  canDelete,
  currentMemberId,
}: TaskBoardProps) {
  const [columns, setColumns] = useState<TaskColumn[]>(() => sortByPosition(initialColumns));
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<TaskColumn | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);

  // Latest tasks for async handlers that need the pre-move layout (revert targets).
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const today = useMemo(() => todayKey(), []);
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const channelsById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const isOverdue = useCallback(
    (task: Task) => {
      if (!task.dueDate || task.dueDate >= today) return false;
      return !(columnsById.get(task.columnId)?.isDone ?? false);
    },
    [today, columnsById]
  );

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter === "me" && task.assigneeMemberId !== currentMemberId) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "me" && task.assigneeMemberId !== Number(assigneeFilter)) {
        return false;
      }
      if (channelFilter !== "all" && task.channelId !== Number(channelFilter)) return false;
      if (overdueOnly && !isOverdue(task)) return false;
      return true;
    });
  }, [tasks, assigneeFilter, channelFilter, overdueOnly, currentMemberId, isOverdue]);

  const filtersActive = assigneeFilter !== "all" || channelFilter !== "all" || overdueOnly;
  const activeTask = activeTaskId === null ? null : (tasks.find((t) => t.id === activeTaskId) ?? null);

  const refreshBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/board");
      if (!res.ok) throw new Error("Pano yüklenemedi");
      const data: { columns: TaskColumn[]; tasks: Task[] } = await res.json();
      setColumns(sortByPosition(data.columns));
      setTasks(data.tasks);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pano yüklenemedi");
    }
  }, []);

  // ---- Task moves (drag & drop + modal column change) ------------------------------------

  const moveTask = useCallback(
    async (taskId: number, columnId: number, position: number | "end"): Promise<boolean> => {
      if (readOnly) return false;
      const before = tasksRef.current;
      const task = before.find((t) => t.id === taskId);
      if (!task) return false;

      const originalIndex = sortByPosition(before.filter((t) => t.columnId === task.columnId)).findIndex(
        (t) => t.id === taskId
      );
      const index =
        position === "end" ? before.filter((t) => t.columnId === columnId && t.id !== taskId).length : position;

      if (task.columnId === columnId && index === originalIndex) return true;

      setTasks((prev) => moveInList(prev, taskId, columnId, index));
      try {
        const res = await fetch(`/api/tasks/${taskId}/move`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId, position: index }),
        });
        if (!res.ok) throw new Error(await readError(res, "Taşınamadı"));
        const saved: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)));
        return true;
      } catch (err) {
        // Put the card back where it came from (against the *current* state, not a stale snapshot).
        setTasks((prev) => moveInList(prev, taskId, task.columnId, originalIndex));
        toast.error(err instanceof Error ? err.message : "Taşınamadı");
        return false;
      }
    },
    [readOnly]
  );

  function handleDragStart(e: DragEvent<HTMLDivElement>, task: Task) {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(task.id));
    setDraggingId(task.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDragOver(e: DragEvent<HTMLElement>, column: TaskColumn, visible: Task[]) {
    if (readOnly || draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Insertion index among the visible cards, from the pointer's Y against card midpoints.
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]")).filter(
      (el) => Number(el.dataset.taskId) !== draggingId
    );
    let visibleIndex = 0;
    for (const el of cards) {
      const rect = el.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) visibleIndex += 1;
      else break;
    }

    // Map the visible index onto the column's full ordering (filters may hide cards between).
    const visibleOthers = visible.filter((t) => t.id !== draggingId);
    const fullOthers = sortByPosition(tasks.filter((t) => t.columnId === column.id && t.id !== draggingId));
    const anchor = visibleOthers[visibleIndex];
    const position = anchor ? fullOthers.findIndex((t) => t.id === anchor.id) : fullOthers.length;

    setDropTarget((prev) =>
      prev && prev.columnId === column.id && prev.visibleIndex === visibleIndex && prev.position === position
        ? prev
        : { columnId: column.id, visibleIndex, position }
    );
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    // Only clear when the pointer actually leaves the column (not when moving between children).
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    // Read the id now: `currentTarget` is gone by the time the updater runs.
    const columnId = Number(e.currentTarget.dataset.columnId);
    setDropTarget((prev) => (prev && prev.columnId === columnId ? null : prev));
  }

  function handleDrop(e: DragEvent<HTMLElement>, column: TaskColumn) {
    if (readOnly) return;
    e.preventDefault();
    const taskId = draggingId ?? Number(e.dataTransfer.getData("text/plain"));
    const target = dropTarget && dropTarget.columnId === column.id ? dropTarget : null;
    setDraggingId(null);
    setDropTarget(null);
    if (!taskId) return;
    void moveTask(taskId, column.id, target ? target.position : "end");
  }

  // ---- Cards ------------------------------------------------------------------------------

  async function addCard(columnId: number, title: string): Promise<boolean> {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, title }),
      });
      if (!res.ok) throw new Error(await readError(res, "Kart eklenemedi"));
      const task: Task = await res.json();
      setTasks((prev) => [...prev, task]);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kart eklenemedi");
      return false;
    }
  }

  const handleTaskSaved = useCallback((saved: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)));
  }, []);

  const handleTaskDeleted = useCallback((taskId: number) => {
    setTasks((prev) => {
      const removed = prev.find((t) => t.id === taskId);
      if (!removed) return prev;
      const siblings = sortByPosition(prev.filter((t) => t.columnId === removed.columnId && t.id !== taskId));
      const resequenced = new Map(siblings.map((t, i) => [t.id, { ...t, position: i }]));
      return prev.filter((t) => t.id !== taskId).map((t) => resequenced.get(t.id) ?? t);
    });
    setActiveTaskId(null);
  }, []);

  const closeModal = useCallback(() => setActiveTaskId(null), []);

  // ---- Columns ----------------------------------------------------------------------------

  async function addColumn(name: string): Promise<boolean> {
    try {
      const res = await fetch("/api/tasks/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res, "Sütun eklenemedi"));
      const column: TaskColumn = await res.json();
      setColumns((prev) => sortByPosition([...prev, column]));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sütun eklenemedi");
      return false;
    }
  }

  async function renameColumn(column: TaskColumn, name: string) {
    setRenamingColumnId(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    setColumns((prev) => prev.map((c) => (c.id === column.id ? { ...c, name: trimmed } : c)));
    try {
      const res = await fetch(`/api/tasks/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await readError(res, "Yeniden adlandırılamadı"));
    } catch (err) {
      setColumns((prev) => prev.map((c) => (c.id === column.id ? { ...c, name: column.name } : c)));
      toast.error(err instanceof Error ? err.message : "Yeniden adlandırılamadı");
    }
  }

  async function shiftColumn(column: TaskColumn, delta: -1 | 1) {
    const currentIndex = columns.findIndex((c) => c.id === column.id);
    const nextIndex = currentIndex + delta;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= columns.length) return;
    const before = columns;
    setColumns((prev) => reorderColumns(prev, column.id, nextIndex));
    try {
      const res = await fetch(`/api/tasks/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: nextIndex }),
      });
      if (!res.ok) throw new Error(await readError(res, "Sütun taşınamadı"));
    } catch (err) {
      setColumns(before);
      toast.error(err instanceof Error ? err.message : "Sütun taşınamadı");
    }
  }

  async function deleteColumn(column: TaskColumn) {
    setColumnToDelete(null);
    try {
      const res = await fetch(`/api/tasks/columns/${column.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Sütun silinemedi"));
      toast.success("Sütun silindi");
      // The server relocates the column's cards (and touches completedAt); pull the result.
      await refreshBoard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sütun silinemedi");
    }
  }

  // ---- Render -----------------------------------------------------------------------------

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Görevler</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {readOnly
              ? "Panoyu görüntüleyebilirsiniz; değişiklik için yetkiniz yok."
              : "Kartları sürükleyip bırakın, detay için karta tıklayın."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Atanan filtresi">
              <option value="all">Atanan: Tümü</option>
              <option value="me">Bana atananlar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} aria-label="Kanal filtresi">
              <option value="all">Kanal: Tümü</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant={overdueOnly ? "primary" : "secondary"}
            size="sm"
            onClick={() => setOverdueOnly((o) => !o)}
            aria-pressed={overdueOnly}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Gecikmiş
          </Button>
          {filtersActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAssigneeFilter("all");
                setChannelFilter("all");
                setOverdueOnly(false);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
              Temizle
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {columns.map((column, index) => {
          const columnTasks = sortByPosition(visibleTasks.filter((t) => t.columnId === column.id));
          const totalCount = tasks.filter((t) => t.columnId === column.id).length;
          const indicatorIndex =
            dropTarget && dropTarget.columnId === column.id && draggingId !== null ? dropTarget.visibleIndex : null;

          return (
            <section
              key={column.id}
              data-column-id={column.id}
              aria-label={column.name}
              onDragOver={(e) => handleDragOver(e, column, columnTasks)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
              className={clsx(
                "flex max-h-[calc(100vh-14rem)] w-72 shrink-0 flex-col rounded-lg border bg-surface transition-colors duration-150",
                indicatorIndex !== null ? "border-brand/60" : "border-line"
              )}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                {renamingColumnId === column.id ? (
                  <InlineNameInput
                    initialValue={column.name}
                    maxLength={60}
                    onSubmit={(name) => renameColumn(column, name)}
                    onCancel={() => setRenamingColumnId(null)}
                  />
                ) : (
                  <h2
                    onDoubleClick={() => !readOnly && setRenamingColumnId(column.id)}
                    title={readOnly ? column.name : "Yeniden adlandırmak için çift tıklayın"}
                    className={clsx(
                      "min-w-0 flex-1 truncate text-sm font-semibold text-ink",
                      !readOnly && "cursor-text select-none"
                    )}
                  >
                    {column.name}
                    {column.isDone && (
                      <span className="ml-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-400">
                        tamamlandı
                      </span>
                    )}
                  </h2>
                )}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted" title="Kart sayısı">
                  {filtersActive && columnTasks.length !== totalCount ? `${columnTasks.length}/${totalCount}` : totalCount}
                </span>
                {!readOnly && (
                  <ColumnMenu
                    canMoveLeft={index > 0}
                    canMoveRight={index < columns.length - 1}
                    onRename={() => setRenamingColumnId(column.id)}
                    onMoveLeft={() => shiftColumn(column, -1)}
                    onMoveRight={() => shiftColumn(column, 1)}
                    onDelete={() => setColumnToDelete(column)}
                  />
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {columnTasks.length === 0 && indicatorIndex === null && (
                  <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
                    Kart yok
                  </p>
                )}
                {columnTasks.map((task, i) => (
                  <div key={task.id}>
                    {indicatorIndex === i && <DropIndicator />}
                    <TaskCard
                      task={task}
                      overdue={isOverdue(task)}
                      assignee={task.assigneeMemberId === null ? undefined : membersById.get(task.assigneeMemberId)}
                      channel={task.channelId === null ? undefined : channelsById.get(task.channelId)}
                      readOnly={readOnly}
                      dragging={draggingId === task.id}
                      onOpen={() => setActiveTaskId(task.id)}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}
                {indicatorIndex !== null && indicatorIndex >= columnTasks.length && <DropIndicator />}
              </div>

              {!readOnly && (
                <footer className="border-t border-line p-2">
                  <AddCardForm onAdd={(title) => addCard(column.id, title)} />
                </footer>
              )}
            </section>
          );
        })}

        {!readOnly && (
          <div className="w-72 shrink-0">
            {addingColumn ? (
              <div className="rounded-lg border border-line bg-surface p-2">
                <InlineNameInput
                  initialValue=""
                  placeholder="Sütun adı"
                  maxLength={60}
                  submitLabel="Ekle"
                  onSubmit={async (name) => {
                    if (await addColumn(name)) setAddingColumn(false);
                  }}
                  onCancel={() => setAddingColumn(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface hover:text-ink"
              >
                <Plus className="h-4 w-4" />
                Sütun
              </button>
            )}
          </div>
        )}
      </div>

      {activeTask && (
        <TaskModal
          key={activeTask.id}
          task={activeTask}
          columns={columns}
          members={members}
          channels={channels}
          readOnly={readOnly}
          canDelete={canDelete}
          onClose={closeModal}
          onSaved={handleTaskSaved}
          onMove={(taskId, columnId) => moveTask(taskId, columnId, "end")}
          onDeleted={handleTaskDeleted}
        />
      )}

      <ConfirmDialog
        open={columnToDelete !== null}
        title="Sütunu sil"
        description={
          columnToDelete && (
            <>
              <strong className="text-ink">{columnToDelete.name}</strong> sütunu silinecek; içindeki kartlar ilk
              sütuna taşınacak.
            </>
          )
        }
        confirmLabel="Sil"
        onConfirm={() => columnToDelete && deleteColumn(columnToDelete)}
        onCancel={() => setColumnToDelete(null)}
      />
    </div>
  );
}

function DropIndicator() {
  return <div className="my-1 h-0.5 rounded-full bg-brand" aria-hidden="true" />;
}

interface InlineNameInputProps {
  initialValue: string;
  placeholder?: string;
  maxLength: number;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/** Inline text field: Enter submits (non-empty), Escape cancels, blur with no change cancels. */
function InlineNameInput({
  initialValue,
  placeholder,
  maxLength,
  submitLabel,
  onSubmit,
  onCancel,
}: InlineNameInputProps) {
  const [value, setValue] = useState(initialValue);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (value.trim() === initialValue.trim()) onCancel();
        }}
        maxLength={maxLength}
        placeholder={placeholder}
        className="px-2 py-1"
        aria-label={placeholder ?? "Ad"}
      />
      {submitLabel && (
        <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={submit}>
          {submitLabel}
        </Button>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCancel}
        aria-label="Vazgeç"
        className="rounded p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

interface AddCardFormProps {
  onAdd: (title: string) => Promise<boolean>;
}

function AddCardForm({ onAdd }: AddCardFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(trimmed);
    setSubmitting(false);
    if (ok) {
      setTitle("");
      // Stay open so several cards can be typed in a row.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
      >
        <Plus className="h-4 w-4" />
        Kart ekle
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setTitle("");
            setOpen(false);
          }
        }}
        maxLength={200}
        placeholder="Kart başlığı"
        aria-label="Kart başlığı"
        className="px-2 py-1.5"
      />
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" onClick={submit} disabled={!title.trim() || submitting}>
          Ekle
        </Button>
        <button
          type="button"
          onClick={() => {
            setTitle("");
            setOpen(false);
          }}
          aria-label="Vazgeç"
          className="rounded p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
