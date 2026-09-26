import type { Role, Sex, TShirtSize } from "@/generated/prisma/enums";
import { SEX_OPTIONS, T_SHIRT_SIZES } from "@/lib/volunteers";

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
  { value: "address", label: "Address" },
] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number]["value"];

// "none" matches people who haven't given one, including people with no
// saved details at all.
export type SexFilter = Sex | "none";
export type SizeFilter = TShirtSize | "none";
export type YesNo = "yes" | "no";

export const SEX_FILTERS: { value: SexFilter; label: string }[] = [
  ...SEX_OPTIONS,
  { value: "none", label: "Not given" },
];

export const SIZE_FILTERS: { value: SizeFilter; label: string }[] = [
  ...T_SHIRT_SIZES,
  { value: "none", label: "Not given" },
];

export const ROLE_FILTERS: { value: Role; label: string }[] = [
  { value: "VOLUNTEER", label: "Volunteers" },
  { value: "ADMIN", label: "Admins" },
];

// The either/or filters, each shown as Any / yes / no.
export const YES_NO_FILTERS = {
  details: { label: "Saved details", yes: "Has details", no: "Signed in only" },
  texts: { label: "Texts", yes: "Opted in", no: "Not opted in" },
  shifts: { label: "Upcoming shifts", yes: "Has shifts", no: "No shifts" },
} as const;

export type YesNoFilter = keyof typeof YES_NO_FILTERS;

export const MAX_AGE = 120;

export type PeopleSearch = {
  by: SearchField;
  q: string;
  sex: SexFilter[];
  size: SizeFilter[];
  ageMin: number | null;
  ageMax: number | null;
  role: Role | null;
  details: YesNo | null;
  texts: YesNo | null;
  shifts: YesNo | null;
  // "2026-09-25", in the admin time zone.
  joinedFrom: string | null;
  joinedTo: string | null;
  page: number;
};

export const EMPTY_SEARCH: PeopleSearch = {
  by: "any",
  q: "",
  sex: [],
  size: [],
  ageMin: null,
  ageMax: null,
  role: null,
  details: null,
  texts: null,
  shifts: null,
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
    sex: pickAll("sex", SEX_FILTERS.map((f) => f.value)),
    size: pickAll("size", SIZE_FILTERS.map((f) => f.value)),
    ageMin,
    ageMax,
    role: pick("role", ROLE_FILTERS.map((f) => f.value)),
    details: yesNo("details"),
    texts: yesNo("texts"),
    shifts: yesNo("shifts"),
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
  for (const sex of search.sex) params.append("sex", sex);
  for (const size of search.size) params.append("size", size);
  if (search.ageMin !== null) params.set("ageMin", String(search.ageMin));
  if (search.ageMax !== null) params.set("ageMax", String(search.ageMax));
  if (search.role) params.set("role", search.role);
  if (search.details) params.set("details", search.details);
  if (search.texts) params.set("texts", search.texts);
  if (search.shifts) params.set("shifts", search.shifts);
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

// Each active filter as a removable chip: its label, and the search without it.
export function activeFilters(search: PeopleSearch) {
  const chips: { label: string; without: Partial<PeopleSearch> }[] = [];
  const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
    options.find((option) => option.value === value)?.label ?? value;

  if (search.sex.length > 0) {
    chips.push({
      label: `Sex: ${search.sex.map((s) => labelOf(SEX_FILTERS, s)).join(", ")}`,
      without: { sex: [] },
    });
  }
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
  if (search.role) {
    chips.push({ label: labelOf(ROLE_FILTERS, search.role), without: { role: null } });
  }
  for (const key of Object.keys(YES_NO_FILTERS) as YesNoFilter[]) {
    const value = search[key];
    if (value) chips.push({ label: YES_NO_FILTERS[key][value], without: { [key]: null } });
  }
  if (search.joinedFrom || search.joinedTo) {
    const { joinedFrom, joinedTo } = search;
    chips.push({
      label:
        joinedFrom && joinedTo
          ? `Joined ${shortDay(joinedFrom)} – ${shortDay(joinedTo)}`
          : joinedFrom
            ? `Joined on or after ${shortDay(joinedFrom)}`
            : `Joined on or before ${shortDay(joinedTo!)}`,
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
