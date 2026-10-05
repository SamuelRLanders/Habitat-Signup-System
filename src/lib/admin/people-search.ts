import type { TShirtSize } from "@/generated/prisma/enums";
import { T_SHIRT_SIZES } from "@/lib/volunteers";

// The admin People page's search and filters. They live in the URL, so a
// search survives a refresh and the CSV download exports exactly what's on
// screen. This file only reads and writes those URL options; the database
// query is in queries.ts.

export const PAGE_SIZE = 100;

export const SEARCH_FIELDS = [
  { value: "any", label: "Any field" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number]["value"];
export type YesNo = "yes" | "no";

export const SIZE_FILTERS = T_SHIRT_SIZES;

// The either/or filters, each shown as Any / yes / no.
export const YES_NO_FILTERS = {
  license: { label: "Driver's license", yes: "Has license", no: "No license" },
  upcoming: {
    label: "Upcoming build days",
    yes: "Signed up for one",
    no: "Not signed up for any",
  },
} as const;

export type YesNoFilter = keyof typeof YES_NO_FILTERS;

export const MAX_AGE = 120;

export type PeopleSearch = {
  by: SearchField;
  q: string;
  size: TShirtSize[];
  ageMin: number | null;
  ageMax: number | null;
  license: YesNo | null;
  upcoming: YesNo | null;
  // A signup form's ID: people signed up through it (not cancelled).
  form: string | null;
  // When they first signed up, "2026-09-25", in the admin time zone.
  joinedFrom: string | null;
  joinedTo: string | null;
  page: number;
};

export const EMPTY_SEARCH: PeopleSearch = {
  by: "any",
  q: "",
  size: [],
  ageMin: null,
  ageMax: null,
  license: null,
  upcoming: null,
  form: null,
  joinedFrom: null,
  joinedTo: null,
  page: 1,
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

// Reads the URL's options. Anything unknown or malformed is ignored, so a
// hand-edited URL can't break the page.
export function parsePeopleSearch(params: Params): PeopleSearch {
  const all = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key);
    const value = params[key];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };
  const one = (key: string) => all(key)[0]?.trim() ?? "";
  const pick = <T extends string>(key: string, allowed: readonly T[]) =>
    allowed.find((value) => value === one(key)) ?? null;
  const pickAll = <T extends string>(key: string, allowed: readonly T[]) =>
    allowed.filter((value) => all(key).includes(value));
  const age = (key: string) => {
    const value = Number(one(key));
    return one(key) !== "" && Number.isInteger(value) && value >= 0 && value <= MAX_AGE
      ? value
      : null;
  };
  const day = (key: string) => (isDay(one(key)) ? one(key) : null);
  const yesNo = (key: string) => pick(key, ["yes", "no"] as const);

  let ageMin = age("ageMin");
  let ageMax = age("ageMax");
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  let joinedFrom = day("joinedFrom");
  let joinedTo = day("joinedTo");
  if (joinedFrom && joinedTo && joinedFrom > joinedTo) [joinedFrom, joinedTo] = [joinedTo, joinedFrom];

  const page = Number(one("page"));

  return {
    by: pick("by", SEARCH_FIELDS.map((f) => f.value)) ?? "any",
    q: one("q").slice(0, 100),
    size: pickAll("size", SIZE_FILTERS.map((f) => f.value)),
    ageMin,
    ageMax,
    license: yesNo("license"),
    upcoming: yesNo("upcoming"),
    form: /^[a-z0-9]{1,40}$/.test(one("form")) ? one("form") : null,
    joinedFrom,
    joinedTo,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// The reverse of parsePeopleSearch: a query string without the leading "?",
// leaving out anything set to its default.
export function toQueryString(search: PeopleSearch) {
  const params = new URLSearchParams();
  if (search.by !== "any") params.set("by", search.by);
  if (search.q) params.set("q", search.q);
  for (const size of search.size) params.append("size", size);
  if (search.ageMin !== null) params.set("ageMin", String(search.ageMin));
  if (search.ageMax !== null) params.set("ageMax", String(search.ageMax));
  if (search.license) params.set("license", search.license);
  if (search.upcoming) params.set("upcoming", search.upcoming);
  if (search.form) params.set("form", search.form);
  if (search.joinedFrom) params.set("joinedFrom", search.joinedFrom);
  if (search.joinedTo) params.set("joinedTo", search.joinedTo);
  if (search.page > 1) params.set("page", String(search.page));
  return params.toString();
}

export function peopleHref(search: PeopleSearch) {
  const query = toQueryString(search);
  return query ? `/admin/people?${query}` : "/admin/people";
}

// The same search with no filters, back on page 1.
export function withoutFilters(search: PeopleSearch): PeopleSearch {
  return { ...EMPTY_SEARCH, by: search.by, q: search.q };
}

// Each active filter as a removable chip: its label, and the search without
// it. formLabels names each signup form by its day.
export function activeFilters(search: PeopleSearch, formLabels: Map<string, string>) {
  const chips: { label: string; without: Partial<PeopleSearch> }[] = [];
  const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
    options.find((option) => option.value === value)?.label ?? value;

  if (search.size.length > 0) {
    chips.push({
      label: `T-shirt: ${search.size.map((s) => labelOf(SIZE_FILTERS, s)).join(", ")}`,
      without: { size: [] },
    });
  }
  if (search.ageMin !== null || search.ageMax !== null) {
    const { ageMin, ageMax } = search;
    chips.push({
      label:
        ageMin !== null && ageMax !== null
          ? ageMin === ageMax
            ? `Age ${ageMin}`
            : `Age ${ageMin}–${ageMax}`
          : ageMin !== null
            ? `Age ${ageMin}+`
            : `Age ${ageMax} or under`,
      without: { ageMin: null, ageMax: null },
    });
  }
  for (const key of Object.keys(YES_NO_FILTERS) as YesNoFilter[]) {
    const value = search[key];
    if (value) chips.push({ label: YES_NO_FILTERS[key][value], without: { [key]: null } });
  }
  if (search.form) {
    chips.push({
      label: `Signed up for ${formLabels.get(search.form) ?? "a removed form"}`,
      without: { form: null },
    });
  }
  if (search.joinedFrom || search.joinedTo) {
    const { joinedFrom, joinedTo } = search;
    chips.push({
      label:
        joinedFrom && joinedTo
          ? `First signed up ${shortDay(joinedFrom)} – ${shortDay(joinedTo)}`
          : joinedFrom
            ? `First signed up on or after ${shortDay(joinedFrom)}`
            : `First signed up on or before ${shortDay(joinedTo!)}`,
      without: { joinedFrom: null, joinedTo: null },
    });
  }
  return chips;
}

function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// "2026-09-25" → "Sep 25, 2026"
function shortDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
