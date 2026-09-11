"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActivityItem } from "@/types";
import type { Member } from "@/lib/db/members";
import { ACTIVITY_TYPES, describeActivity } from "@/lib/activity";
import { ROLE_LABELS } from "@/lib/roles";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { toDateKey } from "@/lib/weekdays";
import { TeamTabs } from "../TeamTabs";

interface ActivityClientProps {
  members: Member[];
}

type Period = "today" | "7d" | "30d" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  custom: "Özel",
};

const TYPE_LABELS: Record<string, string> = {
  channel: "Kanal",
  taxonomy: "Kategori-Konsept",
  schedule: "Takvim",
  member: "Personel",
  auth: "Giriş",
  task: "Görev",
};

const TIME_FORMAT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

interface ActivityResponse {
  items: ActivityItem[];
  summary: Record<number, Record<string, number>> | null;
  nextCursor: number | null;
}

interface ErrorPayload {
  error?: string;
}

function countFor(memberSummary: Record<string, number> | undefined, actions: string[]): number {
  if (!memberSummary) return 0;
  return actions.reduce((sum, action) => sum + (memberSummary[action] ?? 0), 0);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

export function ActivityClient({ members }: ActivityClientProps) {
  const [memberId, setMemberId] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<Period>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [type, setType] = useState("");

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<Record<number, Record<string, number>>>({});
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { from, to } = useMemo(() => {
    const today = toDateKey(new Date());
    if (period === "today") return { from: today, to: today };
    if (period === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { from: toDateKey(d), to: today };
    }
    if (period === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { from: toDateKey(d), to: today };
    }
    return { from: customFrom || undefined, to: customTo || undefined };
  }, [period, customFrom, customTo]);

  const buildParams = useCallback(
    (cursor?: number) => {
      const params = new URLSearchParams();
      if (memberId !== undefined) params.set("memberId", String(memberId));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (type) params.set("type", type);
      if (cursor !== undefined) params.set("cursor", String(cursor));
      return params;
    },
    [memberId, from, to, type]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    try {
      const params = buildParams();
      const res = await fetch(`/api/activity?${params.toString()}`);
      const data: ActivityResponse | ErrorPayload = await res.json();
      if (!res.ok) throw new Error((data as ErrorPayload).error ?? "Hareketler yüklenemedi");
      const payload = data as ActivityResponse;
      setItems(payload.items);
      setNextCursor(payload.nextCursor);
      if (payload.summary) setSummary(payload.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hareketler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const params = buildParams(nextCursor);
      const res = await fetch(`/api/activity?${params.toString()}`);
      const data: ActivityResponse | ErrorPayload = await res.json();
      if (!res.ok) throw new Error((data as ErrorPayload).error ?? "Hareketler yüklenemedi");
      const payload = data as ActivityResponse;
      setItems((prev) => [...prev, ...payload.items]);
      setNextCursor(payload.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hareketler yüklenemedi");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    // load() only calls setState after its internal `await`, never synchronously — this is the
    // standard fetch-on-filter-change pattern, not the cascading-render case the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const cardMembers = useMemo(() => {
    const ids = new Set<number>(Object.keys(summary).map(Number));
    if (memberId !== undefined) ids.add(memberId);
    return members.filter((m) => ids.has(m.id));
  }, [members, summary, memberId]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of items) {
      const key = formatDate(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="animate-fade-in-up">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Hareketler</h1>

      <TeamTabs />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Kişi</label>
          <Select
            value={memberId === undefined ? "" : String(memberId)}
            onChange={(e) => setMemberId(e.target.value === "" ? undefined : Number(e.target.value))}
          >
            <option value="">Tümü</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Dönem</label>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
              <option key={key} value={key}>
                {PERIOD_LABELS[key]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">İşlem türü</label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tümü</option>
            {Object.keys(ACTIVITY_TYPES).map((key) => (
              <option key={key} value={key}>
                {TYPE_LABELS[key] ?? key}
              </option>
            ))}
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Başlangıç</label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Bitiş</label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {cardMembers.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardMembers.map((m) => {
            const memberSummary = summary[m.id];
            return (
              <div key={m.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-ink">{m.displayName}</span>
                  <span className="text-xs text-ink-muted">{ROLE_LABELS[m.role]}</span>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <Stat label="Kanal ekledi" value={countFor(memberSummary, ["channel.create"])} />
                  <Stat label="Düzenledi" value={countFor(memberSummary, ["channel.update"])} />
                  <Stat label="Durum değiştirdi" value={countFor(memberSummary, ["channel.status"])} />
                  <Stat label="Sildi" value={countFor(memberSummary, ["channel.delete"])} />
                  <Stat
                    label="Takvim"
                    value={countFor(memberSummary, ["schedule.upsert", "schedule.delete", "schedule.pattern"])}
                  />
                  <Stat label="Giriş" value={countFor(memberSummary, ["auth.login"])} />
                  {/* TODO(C): görev sayıları */}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </p>
      ) : !loading && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
          Bu dönemde hareket yok.
        </p>
      ) : (
        <div>
          {groups.map(([day, dayItems]) => (
            <div key={day} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-ink-muted">{day}</h3>
              <div className="space-y-1">
                {dayItems.map((item) => {
                  const { subject, text } = describeActivity(item);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover"
                    >
                      <span className="w-12 shrink-0 text-ink-faint">
                        {TIME_FORMAT.format(new Date(item.createdAt))}
                      </span>
                      <span className="w-32 shrink-0 truncate text-ink-muted">{item.memberName ?? "—"}</span>
                      <span className="text-ink-muted">
                        {subject && <span className="font-medium text-ink">{subject} </span>}
                        {text}
                      </span>
                      {item.entityType === "channel" && item.entityId && (
                        <Link href={`/channels/${item.entityId}`} className="text-brand hover:underline">
                          Kanala git
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Yükleniyor..." : "Daha fazla"}
          </Button>
        </div>
      )}
    </div>
  );
}
