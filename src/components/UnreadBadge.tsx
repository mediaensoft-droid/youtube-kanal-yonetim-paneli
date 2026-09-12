"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const POLL_INTERVAL_MS = 15_000;

interface UnreadResponse {
  total: number;
}

/** Small pill next to the "Mesajlar" nav label — polls the unread total every 15s, paused while
 * the tab isn't visible. Only rendered for a signed-in session (checked by the caller too, but
 * this component guards itself so it's safe to mount unconditionally). */
export function UnreadBadge() {
  const { data: session } = useSession();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/messages/unread");
        if (!res.ok) return;
        const data: UnreadResponse = await res.json();
        if (!cancelled) setTotal(data.total);
      } catch {
        // silent — this is a best-effort badge, not a critical fetch
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [session?.user]);

  if (!session?.user || total <= 0) return null;

  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold leading-none text-white">
      {total > 99 ? "99+" : total}
    </span>
  );
}
