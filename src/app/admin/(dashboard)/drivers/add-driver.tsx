"use client";

import { CheckIcon, Loader2Icon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
  addPendingDriver,
  searchDriverCandidates,
  type DriverCandidates,
} from "@/lib/drivers/actions";
import { cn } from "cn";

// How long typing has to pause before searching.
const SEARCH_DELAY_MS = 250;

// The "Add driver" pill on the Drivers page: finding a volunteer who hasn't
// asked to drive and adding them to pending approval. They aren't
// approved here; they're checked against Purdue's list like anyone else.
export function AddDriver() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlusIcon data-icon="inline-start" />
        Add driver
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a driver</DialogTitle>
          <DialogDescription>
            Find a volunteer to add to pending approval. They still have to be
            checked against Purdue&apos;s approved driver list before
            they&apos;re approved.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <AddDriverForm onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddDriverForm({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DriverCandidates | null>(null);
  const [searching, startSearch] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Each search's number, so a slow earlier search can't replace a later one.
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    setQ(value);
    setSelected(null);
    setError(null);
    clearTimeout(timer.current);
    const id = ++latest.current;
    const query = value.trim();
    if (!query) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => {
        const found = await searchDriverCandidates(query);
        if (id === latest.current) setResults(found);
      });
    }, SEARCH_DELAY_MS);
  }

  function add() {
    if (!selected) return;
    setError(null);
    startAdding(async () => {
      const result = await addPendingDriver(selected);
      if (result.error) setError(result.error);
      else onAdded();
    });
  }

  const chosen = results?.matches.find((match) => match.id === selected);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div role="search" aria-label="Volunteers" className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            value={q}
            onChange={(event) => search(event.target.value)}
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
                  search("");
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
                      onClick={() => {
                        setSelected(isSelected ? null : match.id);
                        setError(null);
                      }}
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
                        {match.blocked && (
                          <span className="text-sm font-medium text-destructive">{match.blocked}</span>
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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={add} disabled={!chosen} loading={adding}>
          {adding ? "Adding…" : "Add to pending"}
        </Button>
      </DialogFooter>
    </>
  );
}
