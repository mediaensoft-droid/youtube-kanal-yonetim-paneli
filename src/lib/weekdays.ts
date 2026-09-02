export interface Weekday {
  iso: number; // 1 = Pazartesi ... 7 = Pazar
  short: string;
  label: string;
}

export const WEEKDAYS: Weekday[] = [
  { iso: 1, short: "Pzt", label: "Pazartesi" },
  { iso: 2, short: "Sal", label: "Salı" },
  { iso: 3, short: "Çar", label: "Çarşamba" },
  { iso: 4, short: "Per", label: "Perşembe" },
  { iso: 5, short: "Cum", label: "Cuma" },
  { iso: 6, short: "Cmt", label: "Cumartesi" },
  { iso: 7, short: "Paz", label: "Pazar" },
];

export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function yearMonthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { start: toDateKey(first), end: toDateKey(last) };
}
