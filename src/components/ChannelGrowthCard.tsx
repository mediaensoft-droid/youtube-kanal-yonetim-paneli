// A floating stat card docked over the hero screenshot's corner — real per-channel subscriber
// counts as bars (no fabricated trend line), with the platform-wide total as the headline
// number. Bar heights use a log scale: channel subscriber counts on this platform are heavily
// skewed (one large channel next to many small ones), so a linear scale collapses to one full
// bar and a row of near-invisible slivers — log keeps every channel's bar legible without
// misrepresenting which one is bigger. Pure CSS entrance animation, so this stays a server
// component like the rest of the hero's decorative pieces.

interface ChannelGrowthCardProps {
  totalSubscribers: number;
  bars: number[];
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ChannelGrowthCard({ totalSubscribers, bars }: ChannelGrowthCardProps) {
  if (bars.length === 0) return null;
  const logMax = Math.log(Math.max(...bars, 1) + 1) || 1;

  return (
    <div className="relative mt-4 w-full max-w-[220px] rounded-lg border border-line-strong bg-surface p-4 shadow-2xl shadow-black/50 lg:absolute lg:-bottom-6 lg:-left-6 lg:z-20 lg:mt-0">
      <p className="text-xs text-ink-muted">Platformdaki toplam abone</p>
      <p className="mt-1 text-xl font-semibold text-ink tabular-nums">{formatCompact(totalSubscribers)}</p>
      <div className="mt-3 flex h-10 items-end gap-[3px]" aria-hidden="true">
        {bars.map((count, i) => (
          <span
            key={i}
            className="channel-bar flex-1 origin-bottom rounded-[1px] bg-brand/70"
            style={{
              height: `${Math.max(8, (Math.log(count + 1) / logMax) * 100)}%`,
              animationDelay: `${300 + i * 30}ms`,
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">Kanal başına gerçek abone dağılımı</p>
    </div>
  );
}
