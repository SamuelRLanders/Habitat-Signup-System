import { isDay, shortDay } from "./stats-range";

// The Data page Builds tab's search and filters. Like the People tab's
// (src/lib/admin/people-search.ts) they live in the URL, so a search
// survives a refresh and the CSV download exports exactly what's on
// screen. This file only reads and writes those URL options; the database
// query is in ./builds.ts. No database code, so the browser can use it too.

export const BUILD_PAGE_SIZE = 100;

// When a build is: cancelled (it or its whole event), past (its day is
// over), or upcoming (today or later, including builds on draft forms).
export const BUILD_STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type BuildStatus = (typeof BUILD_STATUSES)[number]["value"];

export type BuildSearch = {
  // Words to find in the build's name or address, or its event's name.
  q: string;
  status: BuildStatus | null;
  // The build's day, both ends included.
  from: string | null;
  to: string | null;
  // A signup form's ID: its builds.
  form: string | null;
  // An admin's user ID: the builds they're responsible for.
  admin: string | null;
  page: number;
};

export const EMPTY_BUILD_SEARCH: BuildSearch = {
  q: "",
  status: null,
  from: null,
  to: null,
  form: null,
  admin: null,
  page: 1,
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// Reads the URL's options. Anything unknown or malformed is ignored.
export function parseBuildSearch(params: Params): BuildSearch {
  const one = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  let from = isDay(one("from")) ? one("from") : null;
  let to = isDay(one("to")) ? one("to") : null;
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number(one("page"));
  return {
    q: one("q").slice(0, 100),
    status: BUILD_STATUSES.find((s) => s.value === one("status"))?.value ?? null,
    from,
    to,
    form: ID.test(one("form")) ? one("form") : null,
    admin: ID.test(one("admin")) ? one("admin") : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// The reverse of parseBuildSearch: a query string without the leading "?",
// leaving out anything set to its default.
export function buildQueryString(search: BuildSearch) {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.status) params.set("status", search.status);
  if (search.from) params.set("from", search.from);
  if (search.to) params.set("to", search.to);
  if (search.form) params.set("form", search.form);
  if (search.admin) params.set("admin", search.admin);
  if (search.page > 1) params.set("page", String(search.page));
  return params.toString();
}

export function buildsHref(search: BuildSearch) {
  const query = buildQueryString(search);
  return query ? `/admin/data/builds?${query}` : "/admin/data/builds";
}

// The same search with no filters, back on page 1.
export function withoutBuildFilters(search: BuildSearch): BuildSearch {
  return { ...EMPTY_BUILD_SEARCH, q: search.q };
}

// Each active filter as a removable chip: its label, and the search without
// it. formLabels and adminLabels name forms and admins by ID.
export function activeBuildFilters(
  search: BuildSearch,
  formLabels: Map<string, string>,
  adminLabels: Map<string, string>,
) {
  const chips: { label: string; without: Partial<BuildSearch> }[] = [];
  if (search.status) {
    const label = BUILD_STATUSES.find((s) => s.value === search.status)!.label;
    chips.push({ label, without: { status: null } });
  }
  if (search.from || search.to) {
    const { from, to } = search;
    chips.push({
      label:
        from && to
          ? from === to
            ? `On ${shortDay(from)}`
            : `${shortDay(from)} – ${shortDay(to)}`
          : from
            ? `On or after ${shortDay(from)}`
            : `On or before ${shortDay(to!)}`,
      without: { from: null, to: null },
    });
  }
  if (search.form) {
    chips.push({ label: `Event: ${formLabels.get(search.form) ?? "a removed form"}`, without: { form: null } });
  }
  if (search.admin) {
    chips.push({
      label: `Responsible: ${adminLabels.get(search.admin) ?? "a removed admin"}`,
      without: { admin: null },
    });
  }
  return chips;
}
