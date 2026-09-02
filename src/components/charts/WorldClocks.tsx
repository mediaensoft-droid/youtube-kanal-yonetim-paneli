"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { CodeDistributionEntry } from "@/lib/stats";
import { COUNTRY_TIMEZONES } from "@/lib/constants/countryTimezones";
import { Flag } from "@/components/Flag";

interface WorldClocksProps {
  data: CodeDistributionEntry[];
}

function formatClock(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

// A day boundary crossing (e.g. it's already tomorrow in Tokyo) is genuinely useful context when
// scheduling uploads across time zones — shown as a small "+1 gün" / "-1 gün" badge next to the time.
function dayOffsetLabel(tz: string, now: Date): string | null {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(now);
  const here = new Intl.DateTimeFormat("en-CA", { dateStyle: "short" }).format(now);
  if (local === here) return null;
  const diffDays = Math.round((new Date(local).getTime() - new Date(here).getTime()) / 86_400_000);
  if (diffDays === 0) return null;
  return diffDays > 0 ? `+${diffDays} gün` : `${diffDays} gün`;
}

export function WorldClocks({ data }: WorldClocksProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // First real render happens client-side only — avoids a server/client markup mismatch from
    // the visitor's clock vs. the server's render time — then ticks once a minute after that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = data
    .filter((d) => d.code !== "OTHER" && COUNTRY_TIMEZONES[d.code])
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  if (entries.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-ink-faint">
        Henüz veri yok
      </div>
    );
  }

  if (!now) {
    return <div className="h-24" aria-hidden="true" />;
  }

  return (
    <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const tz = COUNTRY_TIMEZONES[entry.code];
        const dayOffset = dayOffsetLabel(tz, now);
        return (
          <div
            key={entry.code}
            className="group flex items-center gap-3 rounded-md border border-line bg-surface-2 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xl font-bold tabular-nums text-ink">
                <Flag
                  code={entry.code}
                  className="h-6 w-9 shrink-0 rounded object-cover shadow-sm transition-transform duration-200 group-hover:scale-110"
                />
                {formatClock(tz, now)}
                {dayOffset && (
                  <span className="text-xs font-normal text-ink-faint">{dayOffset}</span>
                )}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-sm text-ink-muted" title={entry.name}>
                <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                {entry.name}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
