"use client";

import { CheckIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

// How long typing has to pause before searching.
const SEARCH_DELAY_MS = 250;

export type VolunteerMatch = {
  id: string;
  name: string;
  email: string;
  // Why they can't be chosen, or null.
  blocked: string | null;
  // Something to know before choosing them.
  note?: string | null;
};

// A search box for finding a volunteer in a popup, such as Add driver,
// with the matches to choose one from. search runs on the server; matches
// that are blocked can't be chosen.
export function VolunteerSearch({
  search,
  selected,
  onSelect,
}: {
  search: (query: string) => Promise<{ matches: VolunteerMatch[]; more: boolean }>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ matches: VolunteerMatch[]; more: boolean } | null>(null);
  const [searching, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Each search's number, so a slow earlier search can't replace a later one.
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(value: string) {
    setQ(value);
    onSelect(null);
    clearTimeout(timer.current);
    const id = ++latest.current;
    const query = value.trim();
    if (!query) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => {
        const found = await search(query);
        if (id === latest.current) setResults(found);
      });
    }, SEARCH_DELAY_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="search" aria-label="Volunteers" className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={q}
          onChange={(event) => change(event.target.value)}
          placeholder="Search by name, email, or phone"
          aria-label="Search volunteers"
          autoComplete="off"
          autoFocus
          maxLength={100}
          className="px-8"
        />
        {searching ? (
          <Loader2Icon
            aria-hidden="true"
            className="absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : (
          q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                change("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-3.5" />
            </button>
          )
        )}
      </div>

      {results && results.matches.length === 0 && !searching && (
        <p role="status" className="py-2 text-center text-sm text-muted-foreground">
          No volunteers match &ldquo;{q.trim()}&rdquo;.
        </p>
      )}

      {results && results.matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul aria-label="Matching volunteers" className="flex flex-col gap-1.5">
            {results.matches.map((match) => {
              const isSelected = match.id === selected;
              return (
                <li key={match.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={match.blocked !== null}
                    onClick={() => onSelect(isSelected ? null : match.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 ring-foreground/10 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      isSelected ? "bg-gold/15 ring-2 ring-gold" : "enabled:hover:bg-muted",
                      match.blocked && "cursor-not-allowed",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("font-medium", match.blocked && "text-muted-foreground")}>
                        {match.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{match.email}</span>
                      {match.blocked ? (
                        <span className="text-sm font-medium text-destructive">{match.blocked}</span>
                      ) : (
                        match.note && <span className="text-sm font-medium">{match.note}</span>
                      )}
                    </span>
                    {isSelected && <CheckIcon aria-hidden="true" className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {results.more && (
            <p className="text-xs text-muted-foreground">
              Showing the first {results.matches.length} matches. Keep typing to narrow them down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
