"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Check, X as XIcon, Plus, RotateCcw } from "lucide-react";
import type { Channel, ScheduleEntry, ScheduleStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { WEEKDAYS, isoWeekday, toDateKey } from "@/lib/weekdays";

interface CalendarClientProps {
  initialChannels: Channel[];
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

export function CalendarClient({ initialChannels }: CalendarClientProps) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ date: string; channelId: number | null } | null>(
    null
  );

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

  function slotsForDate(date: Date): Slot[] {
    const key = toDateKey(date);
    const iso = isoWeekday(date);
    const slots: Slot[] = [];
    for (const channel of channels) {
      const entry = entryMap.get(`${channel.id}|${key}`) ?? null;
      const inPattern = channel.publishDays.includes(iso);
      if (inPattern || entry) {
        slots.push({ channel, entry });
      }
    }
    return slots;
  }

  function toggleChannelDay(channel: Channel, iso: number) {
    const next = channel.publishDays.includes(iso)
      ? channel.publishDays.filter((d) => d !== iso)
      : [...channel.publishDays, iso].sort((a, b) => a - b);

    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, publishDays: next } : c)));

    fetch(`/api/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishDays: next }),
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
        <Button variant="secondary" size="sm" onClick={() => setPanelOpen((o) => !o)}>
          Kanal Yayın Günleri
        </Button>
      </div>

      {panelOpen && (
        <div className="animate-scale-in mb-6 origin-top rounded-lg border border-line bg-surface p-4">
          <p className="mb-3 text-sm text-ink-muted">
            Her kanalın haftalık olarak hangi günler video yayınlayacağını belirleyin. Takvimde o
            kanal o gün otomatik olarak &quot;planlandı&quot; gösterilir.
          </p>
          {channels.length === 0 && (
            <p className="text-sm text-ink-faint">Henüz kanal eklenmedi.</p>
          )}
          <div className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={channel.thumbnailUrl}
                  alt={channel.name}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {channel.name}
                </span>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => {
                    const active = channel.publishDays.includes(day.iso);
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
              </div>
            ))}
          </div>
        </div>
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
          <h2 className="w-40 text-center text-base font-semibold text-ink">
            {MONTH_LABELS[cursor.month]} {cursor.year}
          </h2>
          <button
            onClick={() => goToMonth(1)}
            className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            aria-label="Sonraki ay"
          >
            <ChevronRight className="h-4 w-4" />
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
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-xs">
          {WEEKDAYS.map((day) => (
            <div
              key={day.iso}
              className="bg-surface-2 px-2 py-1.5 text-center font-medium text-ink-muted"
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
                className={clsx("min-h-[100px] bg-surface p-1.5", !inMonth && "opacity-40")}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={clsx(
                      "text-xs",
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand font-semibold text-white"
                        : "text-ink-faint"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <button
                    onClick={() => setActiveSlot({ date: key, channelId: null })}
                    className="rounded p-0.5 text-ink-faint transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
                    aria-label="Video ekle"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {slots.map((slot) => {
                    const status = slot.entry?.status ?? "planned";
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={slot.channel.id}
                        onClick={() => setActiveSlot({ date: key, channelId: slot.channel.id })}
                        className={clsx(
                          "flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px]",
                          meta.chip
                        )}
                        title={slot.entry?.title ?? slot.channel.name}
                      >
                        <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
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

      {activeSlot && (
        <EntryModal
          date={activeSlot.date}
          channels={channels}
          preselectedChannelId={activeSlot.channelId}
          entries={entries}
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
  const inPattern = channel ? channel.publishDays.includes(isoWeekday(new Date(`${date}T00:00:00`))) : false;

  return (
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
    </div>
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
