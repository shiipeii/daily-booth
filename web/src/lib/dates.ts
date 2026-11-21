// all dates in the app are local calendar dates (yyyy-mm-dd) in the couple's timezone.

/** minutes after the ping that still count as "on time" */
export const ON_TIME_MINUTES = 5;

export function localDate(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function parse(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

export function addDays(ymd: string, n: number): string {
  const d = parse(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "sunday 22 november 2026" */
export function longDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(parse(ymd))
    .replace(",", "")
    .toLowerCase();
}

/** "22 november 2026", used on the print */
export function printDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(parse(ymd))
    .toLowerCase();
}

/** "sunday" */
export function weekday(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" })
    .format(parse(ymd))
    .toLowerCase();
}

/** "2:14 pm" in the couple's timezone */
export function clockTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .toLowerCase();
}

/** "10 am" for an hour 0-24 */
export function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" })
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .toLowerCase();
}

export function monthBounds(year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = sunday
  return { first, last, lastDay, firstWeekday };
}

export function isOnTime(takenAt: string, pingSentAt: string | null): boolean {
  if (!pingSentAt) return true;
  return new Date(takenAt).getTime() - new Date(pingSentAt).getTime() <= ON_TIME_MINUTES * 60_000;
}

/** "4:59" */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
