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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUILD_STATUSES,
  buildsHref,
  parseBuildSearch,
  withoutBuildFilters,
  type BuildSearch,
} from "@/lib/data/build-search";
import { Group, Pill } from "../filter-parts";

type Choice = { value: string; label: string };

// The Builds tab's search box and Filters button. Searching changes the
// URL, and the page reruns the search on the server.
export function BuildSearchBar({
  search,
  filterCount,
  forms,
  admins,
}: {
  search: BuildSearch;
  filterCount: number;
  // Signup forms, for the Event filter, and admins, for Responsible admin.
  forms: Choice[];
  admins: Choice[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(search.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the URL when it changes from outside this form, e.g. a filter
  // chip or the back button.
  const href = buildsHref(search);
  const [shownHref, setShownHref] = useState(href);
  if (shownHref !== href) {
    setShownHref(href);
    setQ(search.q);
  }

  function go(next: BuildSearch) {
    startTransition(() => router.push(buildsHref({ ...next, page: 1 })));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        role="search"
        aria-label="Builds"
        onSubmit={(event) => {
          event.preventDefault();
          go({ ...search, q: q.trim() });
        }}
        className="flex min-w-0 flex-1 gap-2"
      >
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
            placeholder="Search by build name, address or event"
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
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center hover-gold rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" loading={pending}>
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
            forms={forms}
            admins={admins}
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
  forms,
  admins,
  onApply,
}: {
  search: BuildSearch;
  forms: Choice[];
  admins: Choice[];
  onApply: (next: BuildSearch) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value !== "") params.append(key, value);
        }
        onApply({ ...parseBuildSearch(params), q: search.q });
      }}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>Filters</DialogTitle>
        <DialogDescription>
          Show only builds that match all of these. Leave a filter empty to
          include every build.
        </DialogDescription>
      </DialogHeader>

      <Group legend="When">
        <Pill type="radio" name="status" value="" label="Any" defaultChecked={!search.status} />
        {BUILD_STATUSES.map((status) => (
          <Pill
            key={status.value}
            type="radio"
            name="status"
            value={status.value}
            label={status.label}
            defaultChecked={search.status === status.value}
          />
        ))}
      </Group>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Build day between</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DatePicker
            name="from"
            aria-label="On or after"
            placeholder="Any start"
            defaultValue={search.from ?? undefined}
            clearable
          />
          <DatePicker
            name="to"
            aria-label="On or before"
            placeholder="Any end"
            defaultValue={search.to ?? undefined}
            clearable
          />
        </div>
      </fieldset>

      <ChoiceSelect name="form" legend="Event" any="Any event" choices={forms} value={search.form} />
      <ChoiceSelect
        name="admin"
        legend="Responsible admin"
        any="Any admin"
        choices={admins}
        value={search.admin}
      />

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => onApply(withoutBuildFilters(search))}>
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

function ChoiceSelect({
  name,
  legend,
  any,
  choices,
  value,
}: {
  name: string;
  legend: string;
  any: string;
  choices: Choice[];
  value: string | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <Select name={name} items={[{ value: "", label: any }, ...choices]} defaultValue={value ?? ""}>
        <SelectTrigger aria-label={legend} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="">{any}</SelectItem>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}
