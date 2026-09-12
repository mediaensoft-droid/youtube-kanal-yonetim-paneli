"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import type { Note } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatRelativeTime } from "@/lib/format";

export interface NotesMember {
  id: number;
  displayName: string;
}

interface NotesClientProps {
  initialNotes: Note[];
  members: NotesMember[];
  currentMemberId: number;
  isOwner: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const OWN_VIEW = "me";

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function firstBodyLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim().length > 0);
  return line?.trim() ?? "";
}

function formatSavedTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

// currentMemberId isn't read directly — every list/save already scopes to the signed-in actor
// server-side — but the prop stays part of the contract per the design doc for future use.
export function NotesClient({ initialNotes, members, isOwner }: NotesClientProps) {
  const [initialSorted] = useState(() => sortNotes(initialNotes));
  const [notes, setNotes] = useState<Note[]>(initialSorted);
  const [selectedId, setSelectedId] = useState<number | null>(initialSorted[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const [viewMemberId, setViewMemberId] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const readOnly = viewMemberId !== null;

  const [title, setTitle] = useState(initialSorted[0]?.title ?? "");
  const [body, setBody] = useState(initialSorted[0]?.body ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);

  // Refs so the debounce/unmount/keyboard-shortcut flush always sees the latest values without
  // needing to be re-created (and re-subscribed) on every keystroke.
  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  const selectedIdRef = useRef(selectedId);
  const readOnlyRef = useRef(readOnly);
  const lastSavedRef = useRef<{ noteId: number | null; title: string; body: string }>({
    noteId: initialSorted[0]?.id ?? null,
    title,
    body,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  const doSave = useCallback(async (noteId: number, nextTitle: string, nextBody: string) => {
    // True only while this exact note is still the one on screen and still editable — the fetch
    // below can outlive the user switching to another note (or to a read-only member view), and
    // that switch's own snapshot/status must win, not whatever this stale request resolves to.
    const isStillCurrent = () => selectedIdRef.current === noteId && !readOnlyRef.current;

    if (
      lastSavedRef.current.noteId === noteId &&
      lastSavedRef.current.title === nextTitle &&
      lastSavedRef.current.body === nextBody
    ) {
      // Nothing actually changed since the last successful save (e.g. the user typed something
      // and undid it before the debounce fired) — don't leave the status stuck on "saving".
      if (isStillCurrent()) {
        setSaveStatus((prev) => (prev === "saving" ? "idle" : prev));
      }
      return;
    }
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle, body: nextBody }),
      });
      if (!res.ok) throw new Error(await readError(res, "Not kaydedilemedi"));
      const updated: Note = await res.json();
      // Always safe to merge the freshly-saved note into the list, regardless of what's selected.
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === updated.id ? updated : n))));
      if (isStillCurrent()) {
        lastSavedRef.current = { noteId, title: nextTitle, body: nextBody };
        setSaveStatus("saved");
        setLastSavedAt(updated.updatedAt);
      }
    } catch {
      if (isStillCurrent()) {
        setSaveStatus("error");
      }
    }
  }, []);

  const flushPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (selectedIdRef.current !== null && !readOnlyRef.current) {
      void doSave(selectedIdRef.current, titleRef.current, bodyRef.current);
    }
  }, [doSave]);

  const scheduleSave = useCallback(
    (noteId: number, nextTitle: string, nextBody: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void doSave(noteId, nextTitle, nextBody);
      }, 800);
    },
    [doSave]
  );

  function handleTitleChange(value: string) {
    if (readOnly || selectedId === null) return;
    setTitle(value);
    titleRef.current = value;
    setSaveStatus("saving");
    scheduleSave(selectedId, value, bodyRef.current);
  }

  function handleBodyChange(value: string) {
    if (readOnly || selectedId === null) return;
    setBody(value);
    bodyRef.current = value;
    setSaveStatus("saving");
    scheduleSave(selectedId, titleRef.current, value);
  }

  function selectNote(note: Note) {
    if (note.id === selectedId) return;
    flushPendingSave();
    setSelectedId(note.id);
    setTitle(note.title);
    setBody(note.body);
    titleRef.current = note.title;
    bodyRef.current = note.body;
    lastSavedRef.current = { noteId: note.id, title: note.title, body: note.body };
    setSaveStatus("idle");
    setLastSavedAt(null);
  }

  // Ctrl/Cmd+S forces an immediate save instead of waiting out the debounce.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushPendingSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flushPendingSave]);

  // Flush a pending debounce on unmount so navigating away never drops the last few keystrokes.
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateNote() {
    if (readOnly || creating) return;
    flushPendingSave();
    setCreating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await readError(res, "Not oluşturulamadı"));
      const note: Note = await res.json();
      setNotes((prev) => sortNotes([note, ...prev]));
      setSelectedId(note.id);
      setTitle(note.title);
      setBody(note.body);
      titleRef.current = note.title;
      bodyRef.current = note.body;
      lastSavedRef.current = { noteId: note.id, title: note.title, body: note.body };
      setSaveStatus("idle");
      setLastSavedAt(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function handleTogglePin() {
    if (readOnly || !selected) return;
    try {
      const res = await fetch(`/api/notes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !selected.pinned }),
      });
      if (!res.ok) throw new Error(await readError(res, "Not güncellenemedi"));
      const updated: Note = await res.json();
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === updated.id ? updated : n))));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not güncellenemedi");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      const res = await fetch(`/api/notes/${target.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await readError(res, "Not silinemedi"));
      setNotes((prev) => {
        const remaining = prev.filter((n) => n.id !== target.id);
        if (selectedId === target.id) {
          const next = remaining[0] ?? null;
          setSelectedId(next?.id ?? null);
          setTitle(next?.title ?? "");
          setBody(next?.body ?? "");
          titleRef.current = next?.title ?? "";
          bodyRef.current = next?.body ?? "";
          lastSavedRef.current = { noteId: next?.id ?? null, title: next?.title ?? "", body: next?.body ?? "" };
          setSaveStatus("idle");
          setLastSavedAt(null);
        }
        return remaining;
      });
      toast.success("Not silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not silinemedi");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleViewChange(value: string) {
    flushPendingSave();
    if (value === OWN_VIEW) {
      setViewMemberId(null);
      setViewLoading(true);
      try {
        const res = await fetch("/api/notes");
        if (!res.ok) throw new Error(await readError(res, "Notlar yüklenemedi"));
        const data: Note[] = await res.json();
        applyNotes(sortNotes(data));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Notlar yüklenemedi");
      } finally {
        setViewLoading(false);
      }
      return;
    }

    const memberId = Number(value);
    setViewMemberId(memberId);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/notes?memberId=${memberId}`);
      if (!res.ok) throw new Error(await readError(res, "Notlar yüklenemedi"));
      const data: Note[] = await res.json();
      applyNotes(sortNotes(data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Notlar yüklenemedi");
    } finally {
      setViewLoading(false);
    }
  }

  function applyNotes(nextNotes: Note[]) {
    setNotes(nextNotes);
    const next = nextNotes[0] ?? null;
    setSelectedId(next?.id ?? null);
    setTitle(next?.title ?? "");
    setBody(next?.body ?? "");
    titleRef.current = next?.title ?? "";
    bodyRef.current = next?.body ?? "";
    lastSavedRef.current = { noteId: next?.id ?? null, title: next?.title ?? "", body: next?.body ?? "" };
    setSaveStatus("idle");
    setLastSavedAt(null);
  }

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }, [notes, search]);

  const viewedMember = viewMemberId !== null ? members.find((m) => m.id === viewMemberId) : null;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Notlarım</h1>
          <p className="mt-1 text-sm text-ink-muted">Kişisel notların yalnızca sana ait; hareket kaydına yazılmaz.</p>
        </div>

        {isOwner && members.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Notlar:</span>
            <div className="w-48">
              <Select
                value={viewMemberId === null ? OWN_VIEW : String(viewMemberId)}
                onChange={(e) => void handleViewChange(e.target.value)}
                disabled={viewLoading}
                aria-label="Görüntülenen üye"
              >
                <option value={OWN_VIEW}>Benim</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {readOnly && viewedMember && (
        <div className="mb-4 inline-flex items-center rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted">
          Salt okunur — {viewedMember.displayName}&apos;in notları
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Notlarda ara…"
              className="pl-9"
            />
          </div>

          {!readOnly && (
            <Button variant="secondary" onClick={() => void handleCreateNote()} disabled={creating}>
              <Plus className="h-4 w-4" />
              Yeni not
            </Button>
          )}

          <div className="flex flex-col gap-1 overflow-y-auto rounded-md border border-line bg-surface-2 p-1.5">
            {viewLoading ? (
              <div className="px-3 py-6 text-center text-sm text-ink-muted">Yükleniyor…</div>
            ) : filteredNotes.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-ink-muted">
                {notes.length === 0
                  ? readOnly
                    ? "Bu personelin notu yok."
                    : "Henüz not yok. İlk notunu oluştur."
                  : "Sonuç bulunamadı."}
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note)}
                  className={clsx(
                    "flex flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors duration-150",
                    note.id === selectedId ? "bg-brand/15 ring-1 ring-brand/40" : "hover:bg-surface-hover"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand" />}
                    <span className="truncate text-sm font-medium text-ink">{note.title || "Başlıksız"}</span>
                  </div>
                  {firstBodyLine(note.body) && (
                    <span className="truncate text-xs text-ink-muted">{firstBodyLine(note.body)}</span>
                  )}
                  <span className="text-xs text-ink-faint">{formatRelativeTime(note.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-md border border-line bg-surface-2 p-4">
          {!selected ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-sm text-ink-muted">
              <StickyNote className="h-8 w-8 text-ink-faint" />
              <p>{readOnly ? "Bu personelin notu yok." : "Henüz not yok. İlk notunu oluştur."}</p>
              {!readOnly && (
                <Button variant="secondary" onClick={() => void handleCreateNote()} disabled={creating}>
                  <Plus className="h-4 w-4" />
                  Yeni not
                </Button>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Başlıksız"
                  disabled={readOnly}
                  className="flex-1 text-base font-semibold"
                />
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "text-xs",
                      saveStatus === "error" ? "text-red-400" : "text-ink-faint"
                    )}
                  >
                    {saveStatus === "saving" && "Kaydediliyor…"}
                    {saveStatus === "saved" && lastSavedAt && `Kaydedildi · ${formatSavedTime(lastSavedAt)}`}
                    {saveStatus === "error" && "Kaydedilemedi"}
                  </span>
                  {!readOnly && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => void handleTogglePin()}>
                        {selected.pinned ? (
                          <>
                            <PinOff className="h-3.5 w-3.5" />
                            Sabitlemeyi kaldır
                          </>
                        ) : (
                          <>
                            <Pin className="h-3.5 w-3.5" />
                            Sabitle
                          </>
                        )}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(selected)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <textarea
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                disabled={readOnly}
                placeholder="Notunu yaz…"
                className={clsx(
                  "min-h-[60vh] w-full flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
                  "transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
                  "disabled:cursor-not-allowed disabled:text-ink-muted"
                )}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Notu sil"
        description={`"${deleteTarget?.title || "Başlıksız"}" notunu silmek istediğine emin misin? Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
