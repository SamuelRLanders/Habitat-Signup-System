"use client";

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_AGE,
  parsePeopleSearch,
  peopleHref,
  ROLE_FILTERS,
  SEARCH_FIELDS,
  SEX_FILTERS,
  SIZE_FILTERS,
  withoutFilters,
  YES_NO_FILTERS,
  type PeopleSearch,
  type SearchField,
  type YesNoFilter,
} from "@/lib/admin/people-search";

const PLACEHOLDERS: Record<SearchField, string> = {
  any: "Search by name, email, or phone",
  firstName: "Search by first name",
  lastName: "Search by last name",
  email: "Search by email",
  phone: "Search by phone number",
  address: "Search by address",
};

// The search box, the field it searches, and the Filters button. Searching
// changes the URL, and the page reruns the search on the server.
export function PeopleSearchBar({
  search,
  filterCount,
}: {
  search: PeopleSearch;
  filterCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [by, setBy] = useState(search.by);
  const [q, setQ] = useState(search.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the URL when it changes from outside this form, e.g. a filter
  // chip or the back button.
  const href = peopleHref(search);
  const [shownHref, setShownHref] = useState(href);
  if (shownHref !== href) {
    setShownHref(href);
    setBy(search.by);
    setQ(search.q);
  }

  function go(next: PeopleSearch) {
    startTransition(() => router.push(peopleHref({ ...next, page: 1 })));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        role="search"
        aria-label="People"
        onSubmit={(event) => {
          event.preventDefault();
          go({ ...search, by, q: q.trim() });
        }}
        className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-nowrap"
      >
        <Select
          items={SEARCH_FIELDS}
          value={by}
          onValueChange={(value) => {
            const field = value as SearchField;
            setBy(field);
            // Rerun a search that's already typed in with the new field.
            if (q.trim()) go({ ...search, by: field, q: q.trim() });
            inputRef.current?.focus();
          }}
        >
          <SelectTrigger aria-label="Search by" className="h-8 w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_FIELDS.map((field) => (
              <SelectItem key={field.value} value={field.value}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            name="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={PLACEHOLDERS[by]}
            aria-label="Search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            className="px-8"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                if (search.q) go({ ...search, q: "" });
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogTrigger render={<Button variant="outline" className="self-start sm:self-auto" />}>
          <SlidersHorizontalIcon aria-hidden="true" />
          Filters
          {filterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
              <span className="sr-only">(</span>
              {filterCount}
              <span className="sr-only"> active)</span>
            </span>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          {/* Mounted only while open, so each opening starts from the URL. */}
          <FiltersForm
            search={search}
            onApply={(next) => {
              setFiltersOpen(false);
              go(next);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The field names match the URL's, so the form's values are read with the
// same parser as the page's URL.
function FiltersForm({
  search,
  onApply,
}: {
  search: PeopleSearch;
  onApply: (next: PeopleSearch) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value !== "") params.append(key, value);
        }
        onApply({ ...parsePeopleSearch(params), by: search.by, q: search.q });
      }}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>Filters</DialogTitle>
        <DialogDescription>
          Show only people who match all of these. Leave a filter empty to
          include everyone.
        </DialogDescription>
      </DialogHeader>

      <Group legend="Sex">
        {SEX_FILTERS.map((option) => (
          <Pill
            key={option.value}
            type="checkbox"
            name="sex"
            value={option.value}
            label={option.label}
            defaultChecked={search.sex.includes(option.value)}
          />
        ))}
      </Group>

      <Group legend="T-shirt size">
        {SIZE_FILTERS.map((option) => (
          <Pill
            key={option.value}
            type="checkbox"
            name="size"
            value={option.value}
            label={option.label}
            defaultChecked={search.size.includes(option.value)}
          />
        ))}
      </Group>

      <Group legend="Age" hint="People without a saved birthday are left out.">
        <NumberField
          name="ageMin"
          aria-label="Minimum age"
          defaultValue={search.ageMin ?? undefined}
          min={0}
          max={MAX_AGE}
        />
        <span className="text-muted-foreground">to</span>
        <NumberField
          name="ageMax"
          aria-label="Maximum age"
          defaultValue={search.ageMax ?? undefined}
          min={0}
          max={MAX_AGE}
        />
      </Group>

      <YesNoGroup filter="texts" search={search} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Joined between</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DatePicker
            name="joinedFrom"
            aria-label="Joined on or after"
            placeholder="Any start"
            defaultValue={search.joinedFrom ?? undefined}
            clearable
          />
          <DatePicker
            name="joinedTo"
            aria-label="Joined on or before"
            placeholder="Any end"
            defaultValue={search.joinedTo ?? undefined}
            clearable
          />
        </div>
      </fieldset>

      <YesNoGroup filter="shifts" search={search} />
      <YesNoGroup filter="details" search={search} />

      <Group legend="Role">
        <Pill type="radio" name="role" value="" label="Any" defaultChecked={!search.role} />
        {ROLE_FILTERS.map((option) => (
          <Pill
            key={option.value}
            type="radio"
            name="role"
            value={option.value}
            label={option.label}
            defaultChecked={search.role === option.value}
          />
        ))}
      </Group>

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => onApply(withoutFilters(search))}>
          Clear all
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button type="submit">Apply filters</Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function Group({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}

// Any / yes / no.
function YesNoGroup({ filter, search }: { filter: YesNoFilter; search: PeopleSearch }) {
  const { label, yes, no } = YES_NO_FILTERS[filter];
  const value = search[filter];
  return (
    <Group legend={label}>
      <Pill type="radio" name={filter} value="" label="Any" defaultChecked={!value} />
      <Pill type="radio" name={filter} value="yes" label={yes} defaultChecked={value === "yes"} />
      <Pill type="radio" name={filter} value="no" label={no} defaultChecked={value === "no"} />
    </Group>
  );
}

// A checkbox or radio button drawn as a pill that fills in when chosen.
function Pill({
  type,
  name,
  value,
  label,
  defaultChecked,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex h-7 items-center rounded-full border border-border px-3 text-[0.8rem] font-medium transition-colors select-none hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:hover:bg-primary/80 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
        {label}
      </span>
    </label>
  );
}
