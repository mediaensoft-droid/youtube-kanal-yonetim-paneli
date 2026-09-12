"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { File as FileIcon, Loader2, Paperclip, Send, X } from "lucide-react";
import type { ConversationsResponse, DmSummary, Message } from "@/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { useActor } from "@/lib/useActor";

// Mirrors src/lib/uploads.ts (server-only, so its constant can't be imported from a client
// component) — this is only a fast client-side rejection; the server re-validates for real.
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

const CONVERSATIONS_POLL_MS = 15_000;
const MESSAGES_POLL_MS = 4_000;

type ClientMessage = Message & { pending?: boolean; failed?: boolean };

interface ActiveConversation {
  kind: "general" | "dm";
  conversationId: number | null;
  memberId: number | null;
  title: string;
}

export interface MessagesClientProps {
  initialConversations: ConversationsResponse;
  currentMemberId: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

function isNearBottom(el: HTMLDivElement, threshold = 96): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function sendWithFile(
  conversationId: number,
  body: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<Message> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/messages/${conversationId}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Message);
        } catch {
          reject(new Error("Sunucu yanıtı okunamadı"));
        }
        return;
      }
      let message = "Mesaj gönderilemedi";
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string };
        if (typeof data.error === "string") message = data.error;
      } catch {
        // keep fallback
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Mesaj gönderilemedi"));

    const formData = new FormData();
    formData.append("file", file);
    if (body) formData.append("body", body);
    xhr.send(formData);
  });
}

function zeroUnreadForConversation(prev: ConversationsResponse, conversationId: number): ConversationsResponse {
  if (prev.general.id === conversationId) {
    return { ...prev, general: { ...prev.general, unread: 0 } };
  }
  return {
    ...prev,
    dms: prev.dms.map((dm) => (dm.conversationId === conversationId ? { ...dm, unread: 0 } : dm)),
  };
}

function AttachmentCard({ message }: { message: ClientMessage }) {
  if (!message.attachmentUrl) return null;
  const isImage = (message.attachmentType ?? "").startsWith("image/");

  if (isImage) {
    return (
      <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.attachmentUrl}
          alt={message.attachmentName ?? "Ek"}
          className="max-h-64 rounded-md border border-line object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={message.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-hover"
    >
      <FileIcon className="h-4 w-4 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1 truncate text-ink">{message.attachmentName}</span>
      <span className="shrink-0 text-xs text-ink-faint">{formatFileSize(message.attachmentSize ?? 0)}</span>
      <span className="shrink-0 text-xs font-medium text-brand">İndir</span>
    </a>
  );
}

interface ConversationRowProps {
  label: string;
  unread: number;
  lastMessageAt: string | null;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ConversationRow({ label, unread, lastMessageAt, active, disabled, onClick }: ConversationRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150",
        active ? "bg-brand-soft font-medium text-ink" : "text-ink-muted hover:bg-surface-hover hover:text-ink"
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        {label}
        {disabled && " (pasif)"}
      </span>
      {lastMessageAt && !active && (
        <span className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(lastMessageAt)}</span>
      )}
      {unread > 0 && (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

export function MessagesClient({ initialConversations, currentMemberId }: MessagesClientProps) {
  const { displayName } = useActor();
  const [conversations, setConversations] = useState<ConversationsResponse>(initialConversations);
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const markedIdRef = useRef(0);
  const stickToBottomRef = useRef(true);

  const openConversation = useCallback(async (next: ActiveConversation) => {
    setActive(next);
    setMessages([]);
    setSelectedFile(null);
    setComposerText("");
    lastIdRef.current = 0;
    markedIdRef.current = 0;
    stickToBottomRef.current = true;

    if (next.conversationId === null) return; // DM not created yet — starts empty, created on first send

    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages/${next.conversationId}`);
      if (!res.ok) throw new Error(await readError(res, "Mesajlar yüklenemedi"));
      const data: Message[] = await res.json();
      setMessages(data);
      if (data.length > 0) {
        const maxId = data[data.length - 1].id;
        lastIdRef.current = maxId;
        markedIdRef.current = maxId;
        await fetch(`/api/messages/${next.conversationId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastReadMessageId: maxId }),
        }).catch(() => {});
        setConversations((prev) => zeroUnreadForConversation(prev, next.conversationId!));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mesajlar yüklenemedi");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // "?member=<id>" nicety: open that DM directly on first load, if it already exists.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const memberIdParam = params.get("member");
    if (!memberIdParam) return;
    const memberId = Number(memberIdParam);
    const dm = initialConversations.dms.find((d) => d.memberId === memberId);
    if (!dm) return;
    // Deferred a tick so openConversation's setState calls don't run synchronously inside this
    // effect's body (which React flags as a cascading-render risk).
    queueMicrotask(() => {
      void openConversation({ kind: "dm", conversationId: dm.conversationId, memberId: dm.memberId, title: dm.displayName });
    });
    // Runs once on mount against the server-provided initial list only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Left-pane conversation list, refreshed every 15s — paused while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/messages/conversations");
        if (!res.ok) return;
        const data: ConversationsResponse = await res.json();
        if (!cancelled) setConversations(data);
      } catch {
        // best-effort — next tick retries
      }
    }
    const interval = setInterval(() => void poll(), CONVERSATIONS_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  // Active conversation's messages, refreshed every 4s — paused while the tab is hidden.
  useEffect(() => {
    if (!active || active.conversationId === null) return;
    const conversationId = active.conversationId;
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/messages/${conversationId}?after=${lastIdRef.current}`);
        if (!res.ok) return;
        const incoming: Message[] = await res.json();
        if (cancelled || incoming.length === 0) return;

        const el = scrollRef.current;
        stickToBottomRef.current = !el || isNearBottom(el);
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const additions = incoming.filter((m) => !known.has(m.id));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });

        const maxId = incoming[incoming.length - 1].id;
        lastIdRef.current = Math.max(lastIdRef.current, maxId);

        if (document.visibilityState === "visible" && maxId > markedIdRef.current) {
          markedIdRef.current = maxId;
          fetch(`/api/messages/${conversationId}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastReadMessageId: maxId }),
          })
            .then(() => setConversations((prev) => zeroUnreadForConversation(prev, conversationId)))
            .catch(() => {});
        }
      } catch {
        // best-effort — next tick retries
      }
    }

    const interval = setInterval(() => void poll(), MESSAGES_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [active]);

  // Auto-scroll: always on our own actions (send, open a conversation) and on incoming
  // messages only when the reader was already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const renderItems = useMemo(() => {
    const items: Array<{ kind: "separator"; date: string } | { kind: "message"; message: ClientMessage }> = [];
    let lastDate = "";
    for (const message of messages) {
      const date = message.createdAt.slice(0, 10);
      if (date !== lastDate) {
        items.push({ kind: "separator", date });
        lastDate = date;
      }
      items.push({ kind: "message", message });
    }
    return items;
  }, [messages]);

  function handleFileChosen(file: File) {
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Dosya 25 MB'tan büyük olamaz");
      return;
    }
    setSelectedFile(file);
  }

  async function handleSend() {
    if (!active || sending) return;
    const trimmedBody = composerText.trim();
    const file = selectedFile;
    if (!trimmedBody && !file) return;

    setSending(true);
    let conversationId = active.conversationId;

    if (conversationId === null) {
      if (active.kind !== "dm" || active.memberId === null) {
        setSending(false);
        return;
      }
      try {
        const res = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: active.memberId }),
        });
        if (!res.ok) throw new Error(await readError(res, "Sohbet oluşturulamadı"));
        const data: { conversationId: number } = await res.json();
        conversationId = data.conversationId;
        const createdMemberId = active.memberId;
        setActive((prev) => (prev && prev.memberId === createdMemberId ? { ...prev, conversationId } : prev));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sohbet oluşturulamadı");
        setSending(false);
        return;
      }
    }

    const tempId = -Date.now();
    const optimistic: ClientMessage = {
      id: tempId,
      conversationId,
      memberId: currentMemberId,
      memberName: displayName || null,
      body: trimmedBody,
      attachmentUrl: file ? URL.createObjectURL(file) : null,
      attachmentName: file?.name ?? null,
      attachmentSize: file?.size ?? null,
      attachmentType: file?.type ?? null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setComposerText("");
    setSelectedFile(null);

    try {
      let saved: Message;
      if (file) {
        saved = await sendWithFile(conversationId, trimmedBody, file, setUploadProgress);
      } else {
        const res = await fetch(`/api/messages/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmedBody }),
        });
        if (!res.ok) throw new Error(await readError(res, "Mesaj gönderilemedi"));
        saved = await res.json();
      }
      stickToBottomRef.current = true;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...saved } : m)));
      lastIdRef.current = Math.max(lastIdRef.current, saved.id);
      markedIdRef.current = Math.max(markedIdRef.current, saved.id);
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Mesajlar</h1>
        <p className="mt-1 text-sm text-ink-muted">Ekip içi genel sohbet ve birebir yazışmalar.</p>
      </div>

      <div className="flex h-[calc(100vh-16rem)] min-h-[420px] gap-4">
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto rounded-md border border-line bg-surface-2 p-1.5">
          <ConversationRow
            label="Genel"
            unread={conversations.general.unread}
            lastMessageAt={null}
            active={active?.kind === "general"}
            onClick={() =>
              void openConversation({ kind: "general", conversationId: conversations.general.id, memberId: null, title: "Genel" })
            }
          />
          <div className="my-1.5 border-t border-line" />
          {conversations.dms.map((dm: DmSummary) => (
            <ConversationRow
              key={dm.memberId}
              label={dm.displayName}
              unread={dm.unread}
              lastMessageAt={dm.lastMessageAt}
              active={active?.kind === "dm" && active.memberId === dm.memberId}
              disabled={dm.status === "disabled"}
              onClick={() =>
                void openConversation({
                  kind: "dm",
                  conversationId: dm.conversationId,
                  memberId: dm.memberId,
                  title: dm.displayName,
                })
              }
            />
          ))}
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-line bg-surface-2">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">Bir sohbet seçin</div>
          ) : (
            <>
              <header className="shrink-0 border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">{active.title}</h2>
              </header>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">Henüz mesaj yok.</div>
                ) : (
                  renderItems.map((item) =>
                    item.kind === "separator" ? (
                      <div key={`sep-${item.date}`} className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-surface px-3 py-1 text-xs text-ink-faint">
                          {formatDate(`${item.date}T00:00:00.000Z`)}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={item.message.id}
                        className={clsx("flex", item.message.memberId === currentMemberId ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={clsx(
                            "max-w-[75%] rounded-lg px-3 py-2",
                            item.message.memberId === currentMemberId
                              ? "bg-brand-soft"
                              : "border border-line bg-surface"
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs text-ink-faint">
                            <span className="font-medium text-ink-muted">{item.message.memberName ?? "Bilinmeyen"}</span>
                            <span>{formatTime(item.message.createdAt)}</span>
                          </div>
                          {item.message.body && (
                            <div className="whitespace-pre-wrap text-sm text-ink">{item.message.body}</div>
                          )}
                          <AttachmentCard message={item.message} />
                          {item.message.pending && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                              <Loader2 className="h-3 w-3 animate-spin" /> Gönderiliyor…
                            </div>
                          )}
                          {item.message.failed && (
                            <div className="mt-1 text-xs text-red-400">Gönderilemedi</div>
                          )}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>

              <div className="shrink-0 border-t border-line p-3">
                {selectedFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs">
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="shrink-0 text-ink-faint hover:text-ink"
                      aria-label="Eki kaldır"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {uploadProgress !== null && (
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-brand transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                    aria-label="Dosya ekle"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChosen(file);
                      e.target.value = "";
                    }}
                  />
                  <Textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Mesaj yazın…"
                    rows={1}
                    className="max-h-32 flex-1 resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSend()}
                    disabled={sending || (!composerText.trim() && !selectedFile)}
                    aria-label="Gönder"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
