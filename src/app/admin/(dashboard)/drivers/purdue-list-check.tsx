"use client";

import { CheckIcon, DownloadIcon } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveFromPurdueList,
  checkPurdueList,
  type PurdueListState,
} from "@/lib/drivers/actions";
import type { ListMatch } from "@/lib/drivers/purdue-match";
import { formatDay } from "@/lib/time";

// Checking drivers against Purdue's approved driver list. It needs a Purdue
// sign-in, so the admin downloads it, then uploads it here. The app reads
// it (without keeping it), matches it against pending and approved drivers,
// and lists the matches to approve.
export function PurdueListCheck({ listUrl }: { listUrl: string }) {
  const [state, check, checking] = useActionState<PurdueListState, FormData>(checkPurdueList, {});

  return (
    <section className="flex flex-col gap-4 rounded-3xl p-5 ring-1 ring-foreground/10 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Check Purdue&apos;s approved driver list</h2>
        <p className="text-sm text-muted-foreground">
          Download Purdue&apos;s list (you&apos;ll need to be signed in to
          Purdue), then upload it here. Pending drivers on the list are matched
          with their approval&apos;s end date, ready to approve. The file
          isn&apos;t kept.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={listUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
        >
          <DownloadIcon data-icon="inline-start" />
          1. Download Purdue&apos;s list
        </a>
        <form action={check} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            aria-label="Purdue's approved driver list (ApprovedDrivers.xlsx)"
            className="max-w-full text-sm file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-muted"
          />
          <Button type="submit" disabled={checking}>
            {checking ? "Checking…" : "2. Check list"}
          </Button>
        </form>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {/* A new key for each check, so approvals from an earlier one reset. */}
      {state.check && <Results key={state.checkedAt} check={state.check} />}
    </section>
  );
}

function Results({ check }: { check: NonNullable<PurdueListState["check"]> }) {
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const waiting = check.matches.filter((match) => !approved.has(match.volunteerId));

  function approve(matches: ListMatch[]) {
    setError(null);
    startTransition(async () => {
      const result = await approveFromPurdueList(
        matches.map(({ volunteerId, until }) => ({ volunteerId, until })),
      );
      if (result.error) setError(result.error);
      setApproved((current) => new Set([...current, ...(result.approved ?? [])]));
    });
  }

  return (
    <div className="flex flex-col gap-5 border-t pt-4">
      <p role="status" className="text-sm">
        Read {check.rowCount.toLocaleString("en-US")} drivers from Purdue&apos;s list.{" "}
        {check.matches.length === 0
          ? "None of our pending drivers are on it yet, and no approvals need extending."
          : `${check.matches.length} of our drivers can be approved or extended.`}
      </p>

      {check.matches.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Ready to approve</h3>
            {waiting.length > 1 && (
              <Button size="sm" disabled={pending} onClick={() => approve(waiting)}>
                {pending ? "Approving…" : `Approve all ${waiting.length}`}
              </Button>
            )}
          </div>
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Matched by</TableHead>
                  <TableHead>Purdue approval ends</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {check.matches.map((match) => (
                  <TableRow key={match.volunteerId}>
                    <TableCell>
                      <span className="font-medium">{match.name}</span>
                      <span className="block text-xs text-muted-foreground">{match.email}</span>
                    </TableCell>
                    <TableCell>
                      {match.by === "email" ? (
                        "Email"
                      ) : (
                        <>
                          Name
                          <span className="block text-xs text-muted-foreground">
                            Double-check it&apos;s them
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDay(match.until, "short")}
                      {match.kind === "extend" && match.currentUntil && (
                        <span className="block text-xs text-muted-foreground">
                          Extends {formatDay(match.currentUntil, "short")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {approved.has(match.volunteerId) ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <CheckIcon className="size-4" aria-hidden="true" />
                          {match.kind === "extend" ? "Extended" : "Approved"}
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => approve([match])}>
                          {match.kind === "extend" ? "Extend" : "Approve"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {check.unclear.length > 0 && (
        <List title="Check by hand">
          {check.unclear.map((item) => (
            <li key={item.name}>
              <span className="font-medium">{item.name}</span>: {item.reason}
            </li>
          ))}
        </List>
      )}

      {check.expired.length > 0 && (
        <List title="On Purdue's list, but expired">
          {check.expired.map((item) => (
            <li key={item.name}>
              <span className="font-medium">{item.name}</span>: ended {formatDay(item.until, "short")}
            </li>
          ))}
        </List>
      )}

      {check.notFound.length > 0 && (
        <List title="Pending, not on Purdue's list yet">
          {check.notFound.map((item) => (
            <li key={item.email}>
              <span className="font-medium">{item.name}</span>{" "}
              <span className="text-muted-foreground">{item.email}</span>
            </li>
          ))}
        </List>
      )}
    </div>
  );
}

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm">{children}</ul>
    </div>
  );
}
