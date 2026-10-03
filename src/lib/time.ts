import { TZDate } from "@date-fns/tz";

// Shift times are stored in UTC and entered and shown in their build's time
// zone. Lafayette, Indiana uses Eastern time.
export const DEFAULT_TIME_ZONE = "America/Indiana/Indianapolis";

export const TIME_ZONES = [
  { value: "America/Indiana/Indianapolis", label: "Eastern (Indiana)" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Mountain (Arizona)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export type TimeZone = (typeof TIME_ZONES)[number]["value"];

export function timeZoneLabel(timeZone: string) {
  return TIME_ZONES.find((zone) => zone.value === timeZone)?.label ?? timeZone;
}

// "2026-10-04" + "08:00" in the given zone → the moment it happens.
export function zonedDateTime(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const zoned = new TZDate(year, month - 1, day, hours, minutes, timeZone);
  return new Date(zoned.getTime());
}

// The reverse of zonedDateTime, for filling in <input type="date"> and
// <input type="time">. "en-CA" formats dates as YYYY-MM-DD.
export function toDateInput(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toTimeInput(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

// "Sat, Oct 4, 2026"
export function formatDate(date: Date, timeZone: string) {
  return date.toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "8:00 AM – 12:00 PM"
export function formatTimeRange(start: Date, end: Date, timeZone: string) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return format.formatRange(start, end);
}

// "Oct 4 – Nov 15, 2026"
export function formatDateRange(start: Date, end: Date, timeZone: string) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return format.formatRange(start, end);
}

// "Sep 24, 2026, 3:15 PM"
export function formatDateTime(date: Date, timeZone: string) {
  return date.toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Days ────────────────────────────────────────────────────────────────────
// A build day is a calendar date with no time or zone, such as a signup
// form's date. In the database it's a date-only column, which Prisma reads
// as midnight UTC.

// A date-only value → "2026-10-10".
export function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

// "2026-10-10" → the value to store in a date-only column.
export function fromDay(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

// "2026-10-10", 1 → "2026-10-11"
export function addDays(day: string, days: number) {
  const date = fromDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

// "2026-10-10" → "Saturday, October 10, 2026", or "Sat, Oct 10, 2026".
export function formatDay(day: string, style: "long" | "short" = "long") {
  return fromDay(day).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style,
    month: style,
    day: "numeric",
    year: "numeric",
  });
}
