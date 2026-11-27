"use client";

import { AlertTriangleIcon } from "lucide-react";
import { cn } from "cn";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { experienceLabel, isHighlyExperienced } from "@/lib/experience";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  assignmentWarnings,
  buildCounts,
  type AssignmentBuild,
  type Assignments,
  type AssignmentVolunteer,
} from "@/lib/placement/assignments";
import { saveAssignments } from "@/lib/signup-forms/assignment-actions";
import { NO_SHOW, type Attendance } from "@/lib/signup-forms/attendance";
import { removeAdded, saveAttendance } from "@/lib/signup-forms/attendance-actions";

export type BoardBuild = AssignmentBuild & { time: string };

export type BoardVolunteer = AssignmentVolunteer & {
  email: string;
  // "Driver · 5 seats", "Needs a ride", "Own way", or null on a form that
  // doesn't ask.
  travelLabel: string | null;
  // The names of the builds they said they could work at.
  chose: string[];
  // How many builds they'd been on before this day.
  builds: number;
  // On the waitlist: chose (buildIds) only full builds, to wait for. They're
  // in the Waitlist column, in the order they joined, until moved to a
  // build.
  waiting: boolean;
  // On the confirmed assignments: the admin who added them without a
  // signup, or null; and the build they were planned for, if any.
  addedBy: string | null;
  planned: { id: string; name: string } | null;
};

// The columns for volunteers who aren't at any build: signed up but not
// placed, waiting, and (on the confirmed assignments) no-shows.
const NOT_PLACED = "not-placed";
const WAITLIST = "waitlist";

// The assignments as columns, one per build plus "Not placed" (and
// "Waitlist", when anyone's waiting), with each volunteer as a card.
// Admins move people with each card's Move menu, which works the same with
// a mouse, a keyboard or a touch screen.
//   - planned: where everyone's going. Moving someone from the waitlist to
//     a build adds them to it when saved; they aren't emailed, so admins
//     check with them first. Saving checks the assignments and lists
//     anything that breaks the placement rules, which the admin can save
//     anyway.
//   - confirmed: where everyone went, once the first build has started,
//     with a "No-shows" column for people who didn't come and didn't
//     cancel. Admins can add people who came without signing up, who start
//     in Not placed. The placement rules don't apply.
export function AssignmentBoard({
  formId,
  mode,
  builds,
  volunteers,
  initial,
  savedAt,
  askTransportation,
  readOnly,
}: {
  formId: string;
  mode: "planned" | "confirmed";
  builds: BoardBuild[];
  volunteers: BoardVolunteer[];
  // Signup ID → their build, NO_SHOW (confirmed only), or null for none.
  initial: Attendance;
  // When the assignments being shown were saved: planned ones by an admin
  // (null for the app's), or confirmed ones (null if they haven't been).
  savedAt: string | null;
  askTransportation: boolean;
  readOnly: boolean;
}) {
  const confirmed = mode === "confirmed";
  // Each moved volunteer's column, by signup ID. Someone added since the
  // page loaded starts where the page says.
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const buildIds = new Set(builds.map((build) => build.id));
  const startColumn = (volunteer: BoardVolunteer) =>
    initial[volunteer.id] ?? (volunteer.waiting ? WAITLIST : NOT_PLACED);
  const columnOf = (volunteer: BoardVolunteer) => moves[volunteer.id] ?? startColumn(volunteer);
  const changed = volunteers.filter((volunteer) => columnOf(volunteer) !== startColumn(volunteer));
  // Who's at each build, for counting.
  const assignments: Assignments = Object.fromEntries(
    volunteers.map((volunteer) => {
      const column = columnOf(volunteer);
      return [volunteer.id, buildIds.has(column) ? column : null];
    }),
  );

  const byName = (a: BoardVolunteer, b: BoardVolunteer) => a.name.localeCompare(b.name);
  const anyWaiting = volunteers.some((volunteer) => volunteer.waiting);
  const label = (id: string) =>
    builds.find((build) => build.id === id)?.name ??
    (id === WAITLIST ? "Waitlist" : id === NO_SHOW ? "No-shows" : "Not placed");
  const columns = [
    ...builds.map((build) => ({ id: build.id, build })),
    ...(confirmed ? [{ id: NO_SHOW, build: null }] : []),
    { id: NOT_PLACED, build: null },
    ...(anyWaiting ? [{ id: WAITLIST, build: null }] : []),
  ];
  // Everyone the rules apply to: those still waiting, and no-shows, aren't
  // going anywhere.
  const counted = volunteers.filter((volunteer) => ![WAITLIST, NO_SHOW].includes(columnOf(volunteer)));

  // Where a volunteer can be moved: a build, or else waiting if they were;
  // not placed, or a no-show if they were signed up to go.
  function movesFor(volunteer: BoardVolunteer) {
    return columns.filter(({ id }) => {
      if (id === WAITLIST) return volunteer.waiting;
      if (id === NOT_PLACED) return !volunteer.waiting;
      if (id === NO_SHOW) return !volunteer.waiting && volunteer.addedBy === null;
      return true;
    });
  }

  function move(volunteerId: string, columnId: string) {
    if (readOnly) return;
    setMoves((current) => ({ ...current, [volunteerId]: columnId }));
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = confirmed
        ? await saveAttendance(
            formId,
            savedAt,
            Object.fromEntries(
              changed.map((volunteer) => {
                const column = columnOf(volunteer);
                return [volunteer.id, buildIds.has(column) || column === NO_SHOW ? column : null];
              }),
            ),
          )
        : await saveAssignments(formId, savedAt, assignments);
      if (result.error) setError(result.error);
      // On success the page reloads with the saved assignments.
      setWarnings(null);
    });
  }

  // Checks the planned assignments first; anything to warn about is shown
  // before saving.
  function trySave() {
    const found = confirmed ? [] : assignmentWarnings(builds, counted, assignments, askTransportation);
    if (found.length > 0) setWarnings(found);
    else save();
  }

  function remove(volunteer: BoardVolunteer) {
    setError(null);
    startTransition(async () => {
      const result = await removeAdded(formId, volunteer.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/95 px-1 py-2 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {changed.length > 0
              ? `${changed.length} ${changed.length === 1 ? "person" : "people"} moved. Not saved yet.`
              : confirmed
                ? "Use a person's Move menu to show where they went, or that they didn't come."
                : "Use a person's Move menu to move them to another build."}
          </p>
          <div className="flex gap-2">
            {changed.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setMoves({})} disabled={pending}>
                Discard changes
              </Button>
            )}
            <Button type="button" size="sm" onClick={trySave} loading={pending} disabled={changed.length === 0}>
              {pending ? "Saving…" : "Save assignments"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map(({ id, build }) => {
          // The waitlist stays in the order people joined.
          const here = volunteers.filter((volunteer) => columnOf(volunteer) === id);
          if (id !== WAITLIST) here.sort(byName);
          const counts = build && buildCounts(build.id, counted, assignments);
          const title = label(id);
          const full = build && counts!.people > build.capacity;
          const short = build && !confirmed && askTransportation && counts!.riders > counts!.seats;
          const unled = build && here.length > 0 && !here.some((volunteer) => isHighlyExperienced(volunteer.builds));
          return (
            <section
              key={id}
              aria-label={title}
              className={cn(
                "flex min-h-40 flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10",
                !build && "bg-muted/40",
              )}
            >
              <header className="flex flex-col gap-0.5 px-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{title}</h2>
                  {build ? (
                    <span className={cn("text-sm tabular-nums", full && "font-medium text-destructive")}>
                      {counts!.people} / {build.capacity}
                    </span>
                  ) : (
                    confirmed && <span className="text-sm tabular-nums">{here.length}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {build
                    ? [
                        build.time,
                        askTransportation &&
                          !confirmed &&
                          `${counts!.riders} ${counts!.riders === 1 ? "rider" : "riders"}, ${counts!.seats} ${counts!.seats === 1 ? "seat" : "seats"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : columnNote(id, confirmed)}
                </p>
                {short && (
                  <p className="text-xs font-medium text-destructive">
                    {counts!.riders - counts!.seats} without a seat in a car
                  </p>
                )}
                {unled && !confirmed && <p className="text-xs font-medium">Nobody highly experienced</p>}
              </header>

              <ul className="flex flex-col gap-2">
                {here.map((volunteer) => (
                  <PersonCard
                    key={volunteer.id}
                    volunteer={volunteer}
                    buildId={build?.id ?? null}
                    column={id}
                    confirmed={confirmed}
                    moved={changed.includes(volunteer)}
                    readOnly={readOnly}
                    columns={movesFor(volunteer).map((column) => ({ value: column.id, label: label(column.id) }))}
                    onMove={(columnId) => move(volunteer.id, columnId)}
                    // Someone added by mistake can be taken off, from Not
                    // placed and before they're moved.
                    onRemove={
                      volunteer.addedBy !== null && id === NOT_PLACED && startColumn(volunteer) === NOT_PLACED
                        ? () => remove(volunteer)
                        : undefined
                    }
                    pending={pending}
                  />
                ))}
                {here.length === 0 && (
                  <li className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    Nobody
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <Dialog open={warnings !== null} onOpenChange={(open) => !open && setWarnings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save with these problems?</DialogTitle>
            <DialogDescription>
              These assignments break the placement rules. You can still save them.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 rounded-2xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
            {warnings?.map((warning) => (
              <li key={warning} className="flex gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {warning}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep editing</DialogClose>
            <Button type="button" onClick={save} loading={pending}>
              {pending ? "Saving…" : "Save anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// What a column that isn't a build is for.
function columnNote(id: string, confirmed: boolean) {
  if (id === NO_SHOW) return "Were going to a build, but didn't come and didn't cancel.";
  if (id === WAITLIST) {
    return confirmed
      ? "Were waiting for a spot. Move anyone who came to the build they went to."
      : "Waiting for a spot, in the order they joined. Check with someone before moving them to a build: they aren't emailed.";
  }
  return confirmed
    ? "Didn't go to any build, such as when there wasn't room for them."
    : "Not going to any build: left off the emails and travel roster.";
}

function PersonCard({
  volunteer,
  buildId,
  column,
  confirmed,
  moved,
  readOnly,
  columns,
  onMove,
  onRemove,
  pending,
}: {
  volunteer: BoardVolunteer;
  // The build they're in now, or null if not placed.
  buildId: string | null;
  // The column they're in now.
  column: string;
  confirmed: boolean;
  moved: boolean;
  readOnly: boolean;
  columns: { value: string; label: string }[];
  onMove: (columnId: string) => void;
  onRemove?: () => void;
  pending: boolean;
}) {
  const added = volunteer.addedBy !== null;
  const unchosen = buildId !== null && !added && !volunteer.buildIds.includes(buildId);
  // On the confirmed assignments, where they were planned to go, when
  // that's not where they are now.
  const plannedElsewhere = confirmed && volunteer.planned !== null && volunteer.planned.id !== column;
  return (
    <li
      title={volunteer.email}
      className={cn(
        "flex items-start gap-2 rounded-lg bg-background p-2 text-sm ring-1 ring-foreground/10",
        moved && "ring-2 ring-gold",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 font-medium">
          {volunteer.name}
          {added && <Badge variant="secondary">Added</Badge>}
          {unchosen && <Badge variant="destructive">Didn&apos;t choose</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            plannedElsewhere && `Planned for ${volunteer.planned!.name}`,
            added ? `Added by ${volunteer.addedBy}` : volunteer.travelLabel,
            experienceLabel(volunteer.builds),
            !added &&
              (volunteer.chose.length > 0
                ? `${volunteer.waiting ? "Waiting for" : "Chose"} ${volunteer.chose.join(", ")}`
                : "Chose no current builds"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {onRemove && !readOnly && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            Remove: added by mistake
          </button>
        )}
      </div>
      {!readOnly && (
        <Select
          items={columns}
          value={column}
          onValueChange={(value) => value && onMove(value as string)}
        >
          <SelectTrigger size="sm" aria-label={`Move ${volunteer.name}`} className="shrink-0 text-xs">
            Move
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end">
            {columns.map((column) => (
              <SelectItem key={column.value} value={column.value}>
                {column.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </li>
  );
}
