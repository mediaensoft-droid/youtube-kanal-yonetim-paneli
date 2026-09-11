"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { toast } from "sonner";
import { X as XIcon, Plus, Trash2, Send } from "lucide-react";
import type { ChecklistItem, Task, TaskColumn, TaskComment, TaskPriority } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatRelativeTime } from "@/lib/format";
import { PRIORITY_LABELS } from "./TaskCard";
import type { BoardChannel, BoardMember } from "./TaskBoard";

interface TaskModalProps {
  task: Task;
  columns: TaskColumn[];
  members: BoardMember[];
  channels: BoardChannel[];
  readOnly: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (task: Task) => void;
  /** Resolves true when the move persisted (the board owns the optimistic reorder + revert). */
  onMove: (taskId: number, columnId: number) => Promise<boolean>;
  onDeleted: (taskId: number) => void;
}

type TaskPatch = {
  title?: string;
  description?: string | null;
  assigneeMemberId?: number | null;
  channelId?: number | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  checklist?: ChecklistItem[];
};

const PRIORITIES: TaskPriority[] = ["high", "normal", "low"];

function newChecklistId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toNullableId(value: string): number | null {
  return value === "" ? null : Number(value);
}

export function TaskModal({
  task,
  columns,
  members,
  channels,
  readOnly,
  canDelete,
  onClose,
  onSaved,
  onMove,
  onDeleted,
}: TaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [columnId, setColumnId] = useState(task.columnId);
  const [assigneeMemberId, setAssigneeMemberId] = useState<number | null>(task.assigneeMemberId);
  const [channelId, setChannelId] = useState<number | null>(task.channelId);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist);
  const [newItemText, setNewItemText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Close on Escape.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Comments are loaded lazily, only when the card is opened.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${task.id}/comments`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Yorumlar yüklenemedi");
        const data: TaskComment[] = await res.json();
        if (!cancelled) setComments(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setComments([]);
        toast.error(err instanceof Error ? err.message : "Yorumlar yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  // Only the fields that actually differ from the saved task go into the PATCH.
  const patch = useMemo<TaskPatch>(() => {
    const next: TaskPatch = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle !== task.title) next.title = trimmedTitle;
    const nextDescription = description.trim() === "" ? null : description;
    if (nextDescription !== (task.description ?? null)) next.description = nextDescription;
    if (assigneeMemberId !== task.assigneeMemberId) next.assigneeMemberId = assigneeMemberId;
    if (channelId !== task.channelId) next.channelId = channelId;
    const nextDueDate = dueDate === "" ? null : dueDate;
    if (nextDueDate !== task.dueDate) next.dueDate = nextDueDate;
    if (priority !== task.priority) next.priority = priority;
    if (JSON.stringify(checklist) !== JSON.stringify(task.checklist)) next.checklist = checklist;
    return next;
  }, [title, description, assigneeMemberId, channelId, dueDate, priority, checklist, task]);

  const columnChanged = columnId !== task.columnId;
  const dirty = Object.keys(patch).length > 0 || columnChanged;

  async function save() {
    if (readOnly || saving) return;
    if (title.trim() === "") {
      toast.error("Başlık gerekli");
      return;
    }
    setSaving(true);
    try {
      if (Object.keys(patch).length > 0) {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
        onSaved(data as Task);
      }
      if (columnChanged) {
        const moved = await onMove(task.id, columnId);
        if (!moved) return; // the board already toasted and reverted the column
      }
      toast.success("Kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Silinemedi");
      }
      toast.success("Görev silindi");
      onDeleted(task.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  function addChecklistItem() {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: newChecklistId(), text, done: false }]);
    setNewItemText("");
  }

  function toggleChecklistItem(id: string) {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function removeChecklistItem(id: string) {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  }

  async function sendComment() {
    const body = commentBody.trim();
    if (!body || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Yorum gönderilemedi");
      setComments((prev) => [...(prev ?? []), data as TaskComment]);
      setCommentBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yorum gönderilemedi");
    } finally {
      setSendingComment(false);
    }
  }

  const checklistDone = checklist.filter((item) => item.done).length;

  // Portal to <body>: the page root carries `.animate-fade-in-up`, whose keyframe leaves a
  // transform behind, which would otherwise make it the containing block for this fixed overlay.
  // The ConfirmDialog is a sibling of the overlay (not a child): React synthetic events bubble
  // through portals along the React tree, so a click inside it would otherwise hit onClose.
  return createPortal(
    <>
      <div
        className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={task.title}
          className="animate-scale-in flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-line-strong bg-surface-2 shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-2 border-b border-line px-5 py-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              maxLength={200}
              placeholder="Görev başlığı"
              aria-label="Başlık"
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-ink placeholder:text-ink-faint transition-colors duration-150 hover:border-line focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:hover:border-transparent"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="rounded p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Sütun</label>
                <Select value={columnId} onChange={(e) => setColumnId(Number(e.target.value))} disabled={readOnly}>
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Atanan</label>
                <Select
                  value={assigneeMemberId ?? ""}
                  onChange={(e) => setAssigneeMemberId(toNullableId(e.target.value))}
                  disabled={readOnly}
                >
                  <option value="">—</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Kanal</label>
                <Select
                  value={channelId ?? ""}
                  onChange={(e) => setChannelId(toNullableId(e.target.value))}
                  disabled={readOnly}
                >
                  <option value="">—</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Son tarih</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">Öncelik</label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={readOnly}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Açıklama</label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
                maxLength={5000}
                placeholder={readOnly ? "—" : "Görevle ilgili notlar…"}
              />
            </div>

            {/* Checklist */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-ink-muted">Kontrol listesi</label>
                {checklist.length > 0 && (
                  <span className="text-xs text-ink-faint">
                    {checklistDone}/{checklist.length}
                  </span>
                )}
              </div>
              {checklist.length > 0 && (
                <div className="mb-1 h-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-300",
                      checklistDone === checklist.length ? "bg-emerald-500" : "bg-brand"
                    )}
                    style={{ width: `${Math.round((checklistDone / checklist.length) * 100)}%` }}
                  />
                </div>
              )}
              <ul className="space-y-1">
                {checklist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleChecklistItem(item.id)}
                      disabled={readOnly}
                      className="h-4 w-4 shrink-0 accent-brand"
                      aria-label={item.text}
                    />
                    <span className={clsx("flex-1 text-sm", item.done ? "text-ink-faint line-through" : "text-ink")}>
                      {item.text}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        aria-label="Maddeyi kaldır"
                        className="rounded p-0.5 text-ink-faint opacity-0 transition-all duration-150 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
                {checklist.length === 0 && readOnly && <li className="text-sm text-ink-faint">—</li>}
              </ul>
              {!readOnly && checklist.length < 50 && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addChecklistItem();
                      }
                    }}
                    maxLength={200}
                    placeholder="Yeni madde…"
                    aria-label="Yeni kontrol listesi maddesi"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addChecklistItem}
                    disabled={!newItemText.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ekle
                  </Button>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">Yorumlar</label>
              {comments === null ? (
                <p className="text-sm text-ink-faint">Yükleniyor…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-ink-faint">Henüz yorum yok.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((comment) => (
                    <li key={comment.id} className="rounded-md border border-line bg-surface px-3 py-2">
                      <div className="mb-0.5 text-xs text-ink-muted">
                        <span className="font-medium text-ink">{comment.memberName ?? "Silinmiş üye"}</span>
                        {" · "}
                        <span title={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-ink">{comment.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!readOnly && (
                <div className="mt-2 flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    maxLength={2000}
                    placeholder="Yorum yaz…"
                    aria-label="Yeni yorum"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={sendComment}
                    disabled={!commentBody.trim() || sendingComment}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Gönder
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
            <div>
              {!readOnly && canDelete && (
                <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Sil
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && dirty && (
                <span className="hidden text-xs text-amber-400 sm:inline">Kaydedilmemiş değişiklik var</span>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Kapat
              </Button>
              {!readOnly && (
                <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Görevi sil"
        description={
          <>
            <strong className="text-ink">{task.title}</strong> görevi ve yorumları kalıcı olarak silinecek.
          </>
        }
        confirmLabel="Sil"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>,
    document.body
  );
}
