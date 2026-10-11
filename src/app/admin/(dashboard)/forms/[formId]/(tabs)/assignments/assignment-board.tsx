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
};

// The column for volunteers who aren't at any build.
const NOT_PLACED = "not-placed";

// The assignments as columns, one per build plus "Not placed", with each
// volunteer as a card. Admins move people with each card's Move menu, which
// works the same with a mouse, a keyboard or a touch screen. Saving checks the
// assignments and lists anything that breaks the placement rules, which the
// admin can save anyway. Read-only once the event day is over.
export function AssignmentBoard({
  formId,
  builds,
  volunteers,
  initial,
  savedAt,
  askTransportation,
  readOnly,
}: {
  formId: string;
  builds: BoardBuild[];
  volunteers: BoardVolunteer[];
  initial: Assignments;
  // When the custom assignments being shown were saved, or null for the
  // app's.
  savedAt: string | null;
  askTransportation: boolean;
  readOnly: boolean;
}) {
  const [assignments, setAssignments] = useState(initial);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = volunteers.filter((volunteer) => (assignments[volunteer.id] ?? null) !== (initial[volunteer.id] ?? null));
  const byName = (a: BoardVolunteer, b: BoardVolunteer) => a.name.localeCompare(b.name);
  const columns = [
    ...builds.map((build) => ({ id: build.id, build })),
    { id: NOT_PLACED, build: null },
  ];

  function move(volunteerId: string, columnId: string) {
    if (readOnly) return;
    setAssignments((current) => ({ ...current, [volunteerId]: columnId === NOT_PLACED ? null : columnId }));
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveAssignments(formId, savedAt, assignments);
      if (result.error) setError(result.error);
      // On success the page reloads with the saved assignments.
      setWarnings(null);
    });
  }

  // Checks first; anything to warn about is shown before saving.
  function trySave() {
    const found = assignmentWarnings(builds, volunteers, assignments, askTransportation);
    if (found.length > 0) setWarnings(found);
    else save();
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/95 px-1 py-2 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {changed.length === 0
              ? "Use a person's Move menu to move them to another build."
              : `${changed.length} ${changed.length === 1 ? "person" : "people"} moved. Not saved yet.`}
          </p>
          <div className="flex gap-2">
            {changed.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAssignments(initial)} disabled={pending}>
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
          const here = volunteers.filter((volunteer) => (assignments[volunteer.id] ?? NOT_PLACED) === id).sort(byName);
          const counts = build && buildCounts(build.id, volunteers, assignments);
          const full = build && counts!.people > build.capacity;
          const short = build && askTransportation && counts!.riders > counts!.seats;
          const unled = build && here.length > 0 && !here.some((volunteer) => isHighlyExperienced(volunteer.builds));
          return (
            <section
              key={id}
              aria-label={build ? build.name : "Not placed"}
              className={cn(
                "flex min-h-40 flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10",
                !build && "bg-muted/40",
              )}
            >
              <header className="flex flex-col gap-0.5 px-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{build ? build.name : "Not placed"}</h2>
                  {build && (
                    <span className={cn("text-sm tabular-nums", full && "font-medium text-destructive")}>
                      {counts!.people} / {build.capacity}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {build
                    ? [
                        build.time,
                        askTransportation &&
                          `${counts!.riders} ${counts!.riders === 1 ? "rider" : "riders"}, ${counts!.seats} ${counts!.seats === 1 ? "seat" : "seats"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Not going to any build: left off the emails and travel roster."}
                </p>
                {short && (
                  <p className="text-xs font-medium text-destructive">
                    {counts!.riders - counts!.seats} without a seat in a car
                  </p>
                )}
                {unled && <p className="text-xs font-medium">Nobody highly experienced</p>}
              </header>

              <ul className="flex flex-col gap-2">
                {here.map((volunteer) => (
                  <PersonCard
                    key={volunteer.id}
                    volunteer={volunteer}
                    buildId={build?.id ?? null}
                    moved={changed.includes(volunteer)}
                    readOnly={readOnly}
                    columns={columns.map((column) => ({
                      value: column.id,
                      label: column.build ? column.build.name : "Not placed",
                    }))}
                    onMove={(columnId) => move(volunteer.id, columnId)}
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

function PersonCard({
  volunteer,
  buildId,
  moved,
  readOnly,
  columns,
  onMove,
}: {
  volunteer: BoardVolunteer;
  // The build they're in now, or null if not placed.
  buildId: string | null;
  moved: boolean;
  readOnly: boolean;
  columns: { value: string; label: string }[];
  onMove: (columnId: string) => void;
}) {
  const unchosen = buildId !== null && !volunteer.buildIds.includes(buildId);
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
          {unchosen && <Badge variant="destructive">Didn&apos;t choose</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[volunteer.travelLabel, experienceLabel(volunteer.builds), volunteer.chose.length > 0 ? `Chose ${volunteer.chose.join(", ")}` : "Chose no current builds"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {!readOnly && (
        <Select
          items={columns}
          value={buildId ?? NOT_PLACED}
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
