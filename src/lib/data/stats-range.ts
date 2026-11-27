// The Statistics tab's time range, kept in the URL: a preset, or custom
// dates. Days are "2026-09-25", in Indiana time. No database code, so the
// browser can use it too.
//
// Purdue's terms, roughly: spring Jan 1 – May 15, summer May 16 – Aug 15,
// fall Aug 16 – Dec 31. A school year runs from fall through summer
// (Aug 16 – Aug 15).

export const RANGE_PRESETS = [
  { value: "this-semester", label: "This semester" },
  { value: "last-semester", label: "Last semester" },
  { value: "this-year", label: "This school year" },
  { value: "last-year", label: "Last school year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export const DEFAULT_PRESET: RangePreset = "this-year";

export type StatsRange = {
  preset: RangePreset;
  // Both ends included; null is open-ended.
  from: string | null;
  to: string | null;
  // "Fall 2026", "2026–27 school year", "All time", or the custom dates.
  label: string;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

// Reads the URL's range (range=, and from= and to= for custom dates) and
// works out its days around today. Anything unknown is ignored.
export function parseStatsRange(params: Params, today: string): StatsRange {
  const one = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const preset = RANGE_PRESETS.find((p) => p.value === one("range"))?.value ?? DEFAULT_PRESET;

  if (preset === "custom") {
    let from = isDay(one("from")) ? one("from") : null;
    let to = isDay(one("to")) ? one("to") : null;
    if (from && to && from > to) [from, to] = [to, from];
    return { preset, from, to, label: customLabel(from, to) };
  }
  if (preset === "all") return { preset, from: null, to: null, label: "All time" };

  const year = Number(today.slice(0, 4));
  if (preset === "this-year" || preset === "last-year") {
    // The school year that started in fall of `start`.
    const start = (today.slice(5) >= "08-16" ? year : year - 1) - (preset === "last-year" ? 1 : 0);
    return {
      preset,
      from: `${start}-08-16`,
      to: `${start + 1}-08-15`,
      label: `${start}–${String(start + 1).slice(2)} school year`,
    };
  }

  let term = termOf(today);
  if (preset === "last-semester") term = previousTerm(term);
  return { preset, ...termDays(term), label: `${TERM_NAMES[term.term]} ${term.year}` };
}

// The query string for a range, without the leading "?". The default
// preset is left out.
export function rangeQuery(range: Pick<StatsRange, "preset" | "from" | "to">) {
  const params = new URLSearchParams();
  if (range.preset !== DEFAULT_PRESET) params.set("range", range.preset);
  if (range.preset === "custom") {
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
  }
  return params.toString();
}

// "Aug 16, 2026 – Dec 31, 2026"
export function rangeDays(range: Pick<StatsRange, "from" | "to">) {
  if (!range.from && !range.to) return "Every event so far";
  if (range.from && range.to) return `${shortDay(range.from)} – ${shortDay(range.to)}`;
  return range.from ? `From ${shortDay(range.from)}` : `Through ${shortDay(range.to!)}`;
}

type Term = { term: "spring" | "summer" | "fall"; year: number };

const TERM_NAMES = { spring: "Spring", summer: "Summer", fall: "Fall" } as const;

function termOf(day: string): Term {
  const year = Number(day.slice(0, 4));
  const monthDay = day.slice(5);
  if (monthDay <= "05-15") return { term: "spring", year };
  if (monthDay <= "08-15") return { term: "summer", year };
  return { term: "fall", year };
}

function previousTerm({ term, year }: Term): Term {
  if (term === "fall") return { term: "summer", year };
  if (term === "summer") return { term: "spring", year };
  return { term: "fall", year: year - 1 };
}

function termDays({ term, year }: Term) {
  if (term === "spring") return { from: `${year}-01-01`, to: `${year}-05-15` };
  if (term === "summer") return { from: `${year}-05-16`, to: `${year}-08-15` };
  return { from: `${year}-08-16`, to: `${year}-12-31` };
}

function customLabel(from: string | null, to: string | null) {
  if (!from && !to) return "All time";
  return rangeDays({ from, to });
}

export function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// "2026-09-25" → "Sep 25, 2026"
export function shortDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
