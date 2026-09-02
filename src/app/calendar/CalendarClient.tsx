"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Check, X as XIcon, Plus, RotateCcw, Clock } from "lucide-react";
import type { Category, Channel, ChannelMonthPattern, Concept, ScheduleEntry, ScheduleStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { WEEKDAYS, isoWeekday, toDateKey, toYearMonth } from "@/lib/weekdays";
import { getLanguageName } from "@/lib/constants/languages";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { VideoCountsPanel } from "./VideoCountsPanel";

interface CalendarClientProps {
  initialChannels: Channel[];
  categories: Category[];
  concepts: Concept[];
}

const MONTH_LABELS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const STATUS_META: Record<ScheduleStatus, { label: string; dot: string; chip: string }> = {
  planned: {
    label: "Planlandı",
    dot: "bg-ink-faint",
    chip: "border-line bg-surface-2 text-ink-muted",
  },
  published: {
    label: "Yayınlandı",
    dot: "bg-emerald-400",
    chip: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  },
  skipped: {
    label: "Atlandı",
    dot: "bg-amber-400",
    chip: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  },
};

interface Slot {
  channel: Channel;
  entry: ScheduleEntry | null;
}

function monthRange(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { first, last };
}

export function CalendarClient({ initialChannels, categories, concepts }: CalendarClientProps) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [patterns, setPatterns] = useState<ChannelMonthPattern[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [panelCategoryFilter, setPanelCategoryFilter] = useState("");
  const [panelConceptFilter, setPanelConceptFilter] = useState("");
  const [panelLanguageFilter, setPanelLanguageFilter] = useState("");
  const [activeSlot, setActiveSlot] = useState<{ date: string; channelId: number | null } | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<
    { date: string; channelId: number; x: number; y: number } | null
  >(null);

  const panelAvailableLanguages = useMemo(() => {
    const codes = new Set<string>();
    channels.forEach((c) => c.languages.forEach((l) => codes.add(l)));
    return [...codes].sort();
  }, [channels]);

  const panelFilteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (panelCategoryFilter && String(c.categoryId ?? "") !== panelCategoryFilter) return false;
      if (panelConceptFilter && String(c.conceptId ?? "") !== panelConceptFilter) return false;
      if (panelLanguageFilter && !c.languages.includes(panelLanguageFilter)) return false;
      return true;
    });
  }, [channels, panelCategoryFilter, panelConceptFilter, panelLanguageFilter]);

  const { first, last } = useMemo(() => monthRange(cursor.year, cursor.month), [cursor]);

  const loadEntries = useCallback(async () => {
    try {
      const start = toDateKey(first);
      const end = toDateKey(last);
      const res = await fetch(`/api/schedule?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Takvim yüklenemedi");
      const data: ScheduleEntry[] = await res.json();
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Takvim yüklenemedi");
    }
  }, [first, last]);

  useEffect(() => {
    // loadEntries() only calls setState after its internal `await`, never synchronously —
    // the standard fetch-on-mount pattern, not the cascading-render case the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
  }, [loadEntries]);

  const entryMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    for (const e of entries) map.set(`${e.channelId}|${e.date}`, e);
    return map;
  }, [entries]);

  const gridDays = useMemo(() => {
    const startOffset = isoWeekday(first) - 1;
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;
    const days: Date[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [first, last]);

  const currentYearMonth = useMemo(
    () => `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`,
    [cursor]
  );

  const loadPatterns = useCallback(async () => {
    try {
      const months = gridDays.map((d) => toYearMonth(d));
      const start = months.reduce((a, b) => (b < a ? b : a));
      const end = months.reduce((a, b) => (b > a ? b : a));
      const res = await fetch(`/api/channel-month-patterns?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Yayın günleri yüklenemedi");
      const data: ChannelMonthPattern[] = await res.json();
      setPatterns(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yayın günleri yüklenemedi");
    }
  }, [gridDays]);

  useEffect(() => {
    // Same fetch-on-mount shape as loadEntries above — see the eslint-disable note there.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPatterns();
  }, [loadPatterns]);

  function effectivePublishDays(channel: Channel, yearMonth: string): number[] {
    const override = patterns.find((p) => p.channelId === channel.id && p.yearMonth === yearMonth);
    return override ? override.publishDays : channel.publishDays;
  }

  function isInPattern(channel: Channel, date: Date): boolean {
    return effectivePublishDays(channel, toYearMonth(date)).includes(isoWeekday(date));
  }

  function slotsForDate(date: Date): Slot[] {
    const key = toDateKey(date);
    const slots: Slot[] = [];
    for (const channel of channels) {
      const entry = entryMap.get(`${channel.id}|${key}`) ?? null;
      if (isInPattern(channel, date) || entry) {
        slots.push({ channel, entry });
      }
    }
    return slots;
  }

  function toggleChannelDay(channel: Channel, iso: number) {
    const base = effectivePublishDays(channel, currentYearMonth);
    const next = base.includes(iso) ? base.filter((d) => d !== iso) : [...base, iso].sort((a, b) => a - b);

    setPatterns((prev) => [
      ...prev.filter((p) => !(p.channelId === channel.id && p.yearMonth === currentYearMonth)),
      { id: -1, channelId: channel.id, yearMonth: currentYearMonth, publishDays: next, createdAt: "", updatedAt: "" },
    ]);

    fetch("/api/channel-month-patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, yearMonth: currentYearMonth, publishDays: next }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Kaydedilemedi");
        const data: ChannelMonthPattern = await res.json();
        setPatterns((prev) => [
          ...prev.filter((p) => !(p.channelId === channel.id && p.yearMonth === currentYearMonth)),
          data,
        ]);
      })
      .catch(() => {
        toast.error("Kaydedilemedi");
        loadPatterns();
      });
  }

  function updatePublishTime(channel: Channel, time: string) {
    const publishTime = time || null;
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, publishTime } : c)));

    fetch(`/api/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishTime }),
    }).catch(() => {
      toast.error("Kaydedilemedi");
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? channel : c)));
    });
  }

  function goToMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }

  async function saveEntry(input: {
    channelId: number;
    date: string;
    status: ScheduleStatus;
    title: string | null;
    notes: string | null;
  }) {
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");
      setEntries((prev) => [...prev.filter((e) => e.id !== data.id), data]);
      toast.success("Kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    }
  }

  async function quickSetStatus(channelId: number, date: string, status: ScheduleStatus) {
    const existing = entries.find((e) => e.channelId === channelId && e.date === date);
    await saveEntry({
      channelId,
      date,
      status,
      title: existing?.title ?? null,
      notes: existing?.notes ?? null,
    });
    setContextMenu(null);
  }

  function openContextMenu(e: React.MouseEvent, date: string, channelId: number) {
    e.preventDefault();
    const menuWidth = 168;
    const menuHeight = 132;
    setContextMenu({
      date,
      channelId,
      x: Math.min(e.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(e.clientY, window.innerHeight - menuHeight - 8),
    });
  }

  function slotTooltip(slot: Slot, date: Date): string {
    const lines = [slot.channel.name, `Tarih: ${formatDate(toDateKey(date))}`];
    if (slot.channel.publishTime) {
      lines.push(`Saat: ${slot.channel.publishTime}`);
    }
    if (slot.entry?.status === "published" && slot.entry.publishedAt) {
      lines.push(`${formatRelativeTime(slot.entry.publishedAt)} yayınlandı`);
    } else {
      lines.push(STATUS_META[slot.entry?.status ?? "planned"].label);
    }
    return lines.join("\n");
  }

  async function removeEntry(entry: ScheduleEntry) {
    try {
      const res = await fetch(`/api/schedule/${entry.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Silinemedi");
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast.success("Sıfırlandı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const today = toDateKey(new Date());

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Yayın Takvimi</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPanelOpen((o) => !o)}>
            Kanal Yayın Günleri
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setVideoPanelOpen((o) => !o)}>
            Video Sayıları
          </Button>
        </div>
      </div>

      {panelOpen && (
        <div className="animate-scale-in mb-6 origin-top rounded-lg border border-line bg-surface p-4">
          <p className="mb-3 text-sm text-ink-muted">
            Her kanalın haftalık olarak hangi günler video yayınlayacağını belirleyin. Takvimde o
            kanal o gün otomatik olarak &quot;planlandı&quot; gösterilir. Gün seçimi yalnızca{" "}
            <strong className="text-ink">
              {MONTH_LABELS[cursor.month]} {cursor.year}
            </strong>{" "}
            ayı için geçerlidir — diğer aylar etkilenmez. Yayın saati ise kanalın tüm aylar için
            geçerli tek bir varsayılanıdır.
          </p>
          {channels.length === 0 && (
            <p className="text-sm text-ink-faint">Henüz kanal eklenmedi.</p>
          )}
          {channels.length > 0 && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Select
                value={panelCategoryFilter}
                onChange={(e) => setPanelCategoryFilter(e.target.value)}
              >
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                value={panelConceptFilter}
                onChange={(e) => setPanelConceptFilter(e.target.value)}
              >
                <option value="">Tüm konseptler</option>
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                value={panelLanguageFilter}
                onChange={(e) => setPanelLanguageFilter(e.target.value)}
              >
                <option value="">Tüm diller</option>
                {panelAvailableLanguages.map((code) => (
                  <option key={code} value={code}>
                    {getLanguageName(code)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {channels.length > 0 && panelFilteredChannels.length === 0 && (
            <p className="text-sm text-ink-faint">Filtrelerle eşleşen kanal bulunamadı.</p>
          )}
          <div className="space-y-3">
            {panelFilteredChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2 p-3"
              >
                <a href={channel.url} target="_blank" rel="noopener noreferrer" title="YouTube'da aç">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={channel.thumbnailUrl}
                    alt={channel.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover transition-opacity duration-150 hover:opacity-80"
                  />
                </a>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {channel.name}
                </span>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => {
                    const active = effectivePublishDays(channel, currentYearMonth).includes(day.iso);
                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => toggleChannelDay(channel, day.iso)}
                        className={clsx(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
                          active
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <input
                    type="time"
                    value={channel.publishTime ?? ""}
                    onChange={(e) => updatePublishTime(channel, e.target.value)}
                    aria-label={`${channel.name} yayın saati`}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {videoPanelOpen && (
        <VideoCountsPanel channels={channels} categories={categories} concepts={concepts} />
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToMonth(-1)}
            className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            aria-label="Önceki ay"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="w-48 text-center text-lg font-semibold text-ink">
            {MONTH_LABELS[cursor.month]} {cursor.year}
          </h2>
          <button
            onClick={() => goToMonth(1)}
            className="rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            aria-label="Sonraki ay"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>
          Bugün
        </Button>
      </div>

      {channels.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-ink-muted">
          Takvimi kullanmak için önce bir kanal ekleyin.
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
          {WEEKDAYS.map((day) => (
            <div
              key={day.iso}
              className="bg-surface-2 px-2 py-2.5 text-center font-medium text-ink-muted"
            >
              {day.short}
            </div>
          ))}
          {gridDays.map((date) => {
            const key = toDateKey(date);
            const inMonth = date.getMonth() === cursor.month;
            const isToday = key === today;
            const slots = slotsForDate(date);
            return (
              <div
                key={key}
                className={clsx("min-h-[160px] bg-surface p-2", !inMonth && "opacity-40")}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={clsx(
                      "text-sm",
                      isToday
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand font-semibold text-white"
                        : "text-ink-faint"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <button
                    onClick={() => setActiveSlot({ date: key, channelId: null })}
                    className="rounded p-1 text-ink-faint transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                    aria-label="Video ekle"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {slots.map((slot) => {
                    const status = slot.entry?.status ?? "planned";
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={slot.channel.id}
                        onClick={() => setActiveSlot({ date: key, channelId: slot.channel.id })}
                        onContextMenu={(e) => openContextMenu(e, key, slot.channel.id)}
                        className={clsx(
                          "flex w-full items-center gap-1.5 truncate rounded border px-2 py-1 text-left text-xs",
                          meta.chip
                        )}
                        title={slotTooltip(slot, date)}
                      >
                        <span className={clsx("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slot.channel.thumbnailUrl}
                          alt=""
                          className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
                        />
                        <span className="truncate">{slot.channel.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-muted">
        {(Object.keys(STATUS_META) as ScheduleStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={clsx("h-2 w-2 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}
          </span>
        ))}
      </div>

      {contextMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(null);
              }}
            />
            <div
              className="animate-scale-in fixed z-50 w-40 origin-top-left rounded-md border border-line-strong bg-surface-2 p-1 shadow-2xl shadow-black/50"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {(Object.keys(STATUS_META) as ScheduleStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => quickSetStatus(contextMenu.channelId, contextMenu.date, s)}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                >
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

      {activeSlot && (
        <EntryModal
          date={activeSlot.date}
          channels={channels}
          preselectedChannelId={activeSlot.channelId}
          entries={entries}
          isInPattern={isInPattern}
          onClose={() => setActiveSlot(null)}
          onSave={saveEntry}
          onDelete={removeEntry}
        />
      )}
    </div>
  );
}

interface EntryModalProps {
  date: string;
  channels: Channel[];
  preselectedChannelId: number | null;
  entries: ScheduleEntry[];
  isInPattern: (channel: Channel, date: Date) => boolean;
  onClose: () => void;
  onSave: (input: {
    channelId: number;
    date: string;
    status: ScheduleStatus;
    title: string | null;
    notes: string | null;
  }) => Promise<void>;
  onDelete: (entry: ScheduleEntry) => Promise<void>;
}

function EntryModal({
  date,
  channels,
  preselectedChannelId,
  entries,
  isInPattern,
  onClose,
  onSave,
  onDelete,
}: EntryModalProps) {
  const [channelId, setChannelId] = useState<number | null>(
    preselectedChannelId ?? channels[0]?.id ?? null
  );
  const existing = useMemo(
    () => entries.find((e) => e.channelId === channelId && e.date === date) ?? null,
    [entries, channelId, date]
  );

  const channel = channels.find((c) => c.id === channelId);
  const inPattern = channel ? isInPattern(channel, new Date(`${date}T00:00:00`)) : false;

  // Portal to <body> — see the note on the context menu above: this page's root wrapper carries
  // `.animate-fade-in-up`, which leaves a non-`none` transform behind, making it the containing
  // block for `position: fixed` descendants left un-portaled.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-sm rounded-lg border border-line-strong bg-surface-2 p-5 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{date}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Kanal</label>
            <Select
              value={channelId ?? ""}
              onChange={(e) => setChannelId(Number(e.target.value))}
              disabled={preselectedChannelId !== null}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {!inPattern && (
              <p className="mt-1 text-xs text-amber-400">
                Bu kanalın normal yayın gününde değil — plan dışı ek video olarak eklenecek.
              </p>
            )}
          </div>

          {channelId && (
            <EntryFields
              key={channelId}
              existing={existing}
              onCancel={onClose}
              onSave={(fields) => onSave({ channelId, date, ...fields })}
              onDelete={existing ? () => onDelete(existing) : undefined}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface EntryFieldsProps {
  existing: ScheduleEntry | null;
  onCancel: () => void;
  onSave: (fields: { status: ScheduleStatus; title: string | null; notes: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function EntryFields({ existing, onCancel, onSave, onDelete }: EntryFieldsProps) {
  const [status, setStatus] = useState<ScheduleStatus>(existing?.status ?? "planned");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ status, title: title.trim() || null, notes: notes.trim() || null });
    setSaving(false);
    onCancel();
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    await onDelete();
    setSaving(false);
    onCancel();
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Durum</label>
        <div className="flex gap-2">
          {(Object.keys(STATUS_META) as ScheduleStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={clsx(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors duration-150",
                status === s
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Video başlığı (opsiyonel)</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video başlığı" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Not (opsiyonel)</label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        {onDelete ? (
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Vazgeç
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Check className="h-3.5 w-3.5" /> Kaydet
          </Button>
        </div>
      </div>
    </>
  );
}
