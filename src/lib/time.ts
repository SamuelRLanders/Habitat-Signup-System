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
