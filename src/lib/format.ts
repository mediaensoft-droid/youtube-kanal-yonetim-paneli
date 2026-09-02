export function formatCompactNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diffMs < minute) return "az önce";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} dakika önce`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} saat önce`;
  if (diffMs < month) return `${Math.floor(diffMs / day)} gün önce`;
  if (diffMs < year) return `${Math.floor(diffMs / month)} ay önce`;
  return `${Math.floor(diffMs / year)} yıl önce`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
