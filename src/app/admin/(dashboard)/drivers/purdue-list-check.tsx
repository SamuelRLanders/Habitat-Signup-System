"use client";

import { CheckIcon, DownloadIcon, UploadIcon, WandSparklesIcon } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// The "Auto approve" pill on the Drivers page: checking drivers against
// Purdue's approved driver list. It needs a Purdue sign-in, so the admin
// downloads it, then uploads it here. The app reads it (without keeping
// it), matches it against pending and approved drivers, and lists the
// matches to approve.
export function PurdueListCheck({ listUrl }: { listUrl: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <WandSparklesIcon data-icon="inline-start" />
        Auto approve
      </DialogTrigger>
      {/* The body scrolls on its own, so long results keep the box's shape. */}
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auto approve drivers</DialogTitle>
          <DialogDescription>
            Check Purdue&apos;s approved driver list. Pending drivers on it are
            matched with their approval&apos;s end date, ready to approve. The
            file isn&apos;t kept.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <ListCheck listUrl={listUrl} />
      </DialogContent>
    </Dialog>
  );
}

function ListCheck({ listUrl }: { listUrl: string }) {
  const [state, check, checking] = useActionState<PurdueListState, FormData>(checkPurdueList, {});
  // The chosen file's name. React resets the form after each check, which
  // clears the file input, so this clears with it.
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-1">
      <form action={check} onReset={() => setFileName(null)}>
        <ol className="flex flex-col gap-4">
          <Step number={1} title="Download Purdue's list" hint="You'll need to be signed in to Purdue.">
            <a
              href={listUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              <DownloadIcon data-icon="inline-start" />
              Download list
            </a>
          </Step>

          <Step number={2} title="Upload it here" hint="The file is called ApprovedDrivers.xlsx.">
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="purdue-list-file"
                type="file"
                name="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? null)}
                className="peer sr-only"
              />
              <label
                htmlFor="purdue-list-file"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                })}
              >
                <UploadIcon data-icon="inline-start" />
                Choose file
              </label>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {fileName ?? "No file chosen"}
              </span>
            </div>
          </Step>

          <Step number={3} title="Check the list" hint="Matches show up below, ready to approve.">
            <Button type="submit" size="sm" className="w-fit" disabled={checking || !fileName}>
              {checking ? "Checking…" : "Check list"}
            </Button>
          </Step>
        </ol>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {/* A new key for each check, so approvals from an earlier one reset. */}
      {state.check && <Results key={state.checkedAt} check={state.check} />}
    </div>
  );
}

// One numbered step, with its control under the title.
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-semibold text-black"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            <span className="sr-only">Step {number}: </span>
            {title}
          </span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </div>
        {children}
      </div>
    </li>
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
