"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import { FieldError } from "@/components/field-error";
import { TimeSelect } from "@/components/time-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BuildErrors } from "@/lib/form-builds";
import { FormLinkDialog, ReserveDialog, type ReservedSpot } from "./reserve-dialog";

export type BuildDefaults = {
  id: string; // empty for a new build
  name: string;
  address: string;
  startTime: string; // "08:00"
  endTime: string;
  capacity: string;
  description: string;
  lunch: string;
  // The admin responsible for organizing it, or empty to choose one.
  responsibleId: string;
  // Spots held for named volunteers, out of its spots.
  reservations: ReservedSpot[];
  cancelled: boolean;
  // Volunteers have chosen it, so removing it cancels it instead of
  // deleting it.
  chosen: boolean;
};

export const NEW_BUILD: BuildDefaults = {
  id: "",
  name: "",
  address: "",
  startTime: "",
  endTime: "",
  capacity: "",
  description: "",
  lunch: "",
  responsibleId: "",
  reservations: [],
  cancelled: false,
  chosen: false,
};

// An admin who can be responsible for a build: an editor or the owner.
export type ResponsibleAdmin = { id: string; name: string };

// The builds on a signup form: where groups are working that day, which
// volunteers choose from. Sends one of each "build…" field per build, in
// order (see src/lib/form-builds.ts). A cancelled build keeps its fields,
// hidden, so they're sent unchanged. The inputs are uncontrolled and keyed,
// so removing a build doesn't move what's been typed into another. Each
// build's reserved spots are sent as JSON ("buildReservations").
export function BuildFields({
  defaults,
  errors,
  admins,
  newResponsibleId,
  reservationsLocked = false,
  formId = null,
}: {
  defaults: BuildDefaults[];
  errors: Record<number, BuildErrors>;
  admins: ResponsibleAdmin[];
  // The responsible admin a new build starts with: the admin editing.
  newResponsibleId: string;
  // The first build has started, so reserved spots can't change.
  reservationsLocked?: boolean;
  // The form, once it exists: for its link, to send to volunteers with
  // reserved spots, and to say who's signed up on it already.
  formId?: string | null;
}) {
  // Each build's key, for its fields' IDs: numbered in order, so the server
  // and the browser give the same ones.
  const [builds, setBuilds] = useState(() =>
    defaults.map((build, index) => ({
      ...build,
      spots: Number(build.capacity) || null,
      key: String(index),
    })),
  );
  const nextKey = useRef(defaults.length);
  // Everyone with a reserved spot on the form: one each.
  const reservedEmails = new Set(builds.flatMap((build) => build.reservations.map((spot) => spot.email)));

  function add() {
    const key = String(nextKey.current++);
    setBuilds((current) => [...current, { ...NEW_BUILD, responsibleId: newResponsibleId, spots: null, key }]);
  }

  function update(index: number, change: Partial<(typeof builds)[number]>) {
    setBuilds((current) => current.map((build, i) => (i === index ? { ...build, ...change } : build)));
  }

  // A build volunteers chose is cancelled; any other is dropped, and
  // deleted when the form is saved.
  function remove(index: number) {
    setBuilds((current) =>
      current[index].chosen && !current[index].cancelled
        ? current.map((build, i) => (i === index ? { ...build, cancelled: true } : build))
        : current.filter((_, i) => i !== index),
    );
  }

  function restore(index: number) {
    setBuilds((current) =>
      current.map((build, i) => (i === index ? { ...build, cancelled: false } : build)),
    );
  }

  return (
    <div role="group" aria-labelledby="builds-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p id="builds-heading" className="text-sm font-medium">
          Builds
        </p>
        <p className="text-sm text-muted-foreground">
          Where groups are working on this day. Volunteers choose every build
          they could work at, and are placed at one of them. Times are in
          Eastern (Indiana) time.
        </p>
      </div>

      {builds.map((build, index) => {
        const buildErrors = errors[index] ?? {};
        // A cancelled build's fields stay hidden unless one needs fixing.
        const hideFields = build.cancelled && Object.keys(buildErrors).length === 0;
        const id = `build-${build.key}`;
        const label = build.name || `Build ${index + 1}`;
        const aria = (field: keyof BuildErrors) => ({
          "aria-invalid": buildErrors[field] ? true : undefined,
          "aria-describedby": buildErrors[field] ? `${id}-${field}-error` : undefined,
        });
        return (
          <div
            key={build.key}
            className={cn(
              "flex flex-col gap-3 hover-gold rounded-xl p-4 ring-1 ring-foreground/10",
              build.cancelled && "bg-muted/40",
            )}
          >
            <input type="hidden" name="buildId" value={build.id} />
            <input type="hidden" name="buildCancelled" value={build.cancelled ? "yes" : "no"} />
            <input
              type="hidden"
              name="buildReservations"
              value={JSON.stringify(build.reservations.map(({ email }) => ({ email })))}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
                {build.cancelled ? (
                  <>
                    <span className="truncate text-foreground">{label}</span>
                    <Badge variant="destructive">Cancelled</Badge>
                  </>
                ) : (
                  `Build ${index + 1}`
                )}
              </span>
              <div className="flex gap-1">
                {build.cancelled && (
                  <Button type="button" variant="outline" size="sm" onClick={() => restore(index)}>
                    Restore
                  </Button>
                )}
                {!(build.cancelled && build.chosen) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${label}`}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            </div>

            {build.cancelled && (
              <p className="text-sm text-muted-foreground">
                {build.chosen
                  ? "Not offered on the form. Volunteers who chose it are kept, and count again if you restore it."
                  : "Not offered on the form. Restore it, or remove it to delete it."}
              </p>
            )}

            <div className={cn("flex flex-col gap-3", hideFields && "hidden")}>
              {build.chosen && (
                <p className="text-sm text-muted-foreground">
                  Volunteers have chosen this build, so removing it cancels it
                  rather than deleting it.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-name`}>Name</Label>
                <Input
                  id={`${id}-name`}
                  name="buildName"
                  defaultValue={build.name}
                  placeholder="e.g. Maple Street Home"
                  autoComplete="off"
                  {...aria("name")}
                />
                <FieldError field={`${id}-name`} error={buildErrors.name} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-address`}>Address</Label>
                <Input
                  id={`${id}-address`}
                  name="buildAddress"
                  defaultValue={build.address}
                  placeholder="123 Main St, Lafayette, IN 47901"
                  autoComplete="off"
                  {...aria("address")}
                />
                <FieldError field={`${id}-address`} error={buildErrors.address} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-startTime`}>Start time</Label>
                  <TimeSelect
                    id={`${id}-startTime`}
                    name="buildStart"
                    defaultValue={build.startTime}
                    {...aria("startTime")}
                  />
                  <FieldError field={`${id}-startTime`} error={buildErrors.startTime} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-endTime`}>End time</Label>
                  <TimeSelect
                    id={`${id}-endTime`}
                    name="buildEnd"
                    defaultValue={build.endTime}
                    {...aria("endTime")}
                  />
                  <FieldError field={`${id}-endTime`} error={buildErrors.endTime} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-capacity`}>Volunteer spots</Label>
                  <NumberField
                    id={`${id}-capacity`}
                    name="buildSpots"
                    defaultValue={Number(build.capacity) || undefined}
                    onValueChange={(value) => update(index, { spots: value })}
                    // Reserved spots are some of its spots.
                    min={Math.max(1, build.reservations.length)}
                    max={500}
                    {...aria("capacity")}
                  />
                  <FieldError field={`${id}-capacity`} error={buildErrors.capacity} />
                </div>
                <div className="flex flex-col gap-2">
                  <p id={`${id}-reserved`} className="text-sm leading-none font-medium select-none">
                    Reserved spots
                  </p>
                  <p className="flex h-8 items-center text-sm tabular-nums">
                    {build.reservations.length}
                    {build.spots !== null &&
                      ` · ${Math.max(0, build.spots - build.reservations.length)} for everyone else`}
                  </p>
                </div>
              </div>

              <Reservations
                id={id}
                buildName={label}
                spots={build.reservations}
                full={build.spots !== null && build.reservations.length >= build.spots}
                locked={reservationsLocked}
                reservedEmails={reservedEmails}
                formId={formId}
                error={buildErrors.reservations}
                onChange={(reservations) => update(index, { reservations })}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-responsible`}>Responsible admin</Label>
                <Select
                  name="buildResponsible"
                  items={admins.map((admin) => ({ value: admin.id, label: admin.name }))}
                  // An admin no longer allowed shows as unchosen.
                  defaultValue={admins.some((admin) => admin.id === build.responsibleId) ? build.responsibleId : null}
                >
                  <SelectTrigger id={`${id}-responsible`} className="w-full" {...aria("responsibleId")}>
                    <SelectValue placeholder="Choose an admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  The editor organizing this build. If the form emails admins
                  about cancellations, they get those for this build. Only
                  editors and the owner can be chosen.
                </p>
                <FieldError field={`${id}-responsible`} error={buildErrors.responsibleId} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-description`}>
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id={`${id}-description`}
                  name="buildDescription"
                  defaultValue={build.description}
                  rows={3}
                  placeholder="e.g. Framing. No experience needed. Bring work gloves."
                  {...aria("description")}
                />
                <FieldError field={`${id}-description`} error={buildErrors.description} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-lunch`}>
                  Lunch <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id={`${id}-lunch`}
                  name="buildLunch"
                  defaultValue={build.lunch}
                  rows={2}
                  placeholder="e.g. Lunch provided by the homeowner. Bring a water bottle."
                  {...aria("lunch")}
                />
                <FieldError field={`${id}-lunch`} error={buildErrors.lunch} />
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={add} className="w-fit">
        <PlusIcon data-icon="inline-start" />
        Add build
      </Button>
    </div>
  );
}

// The volunteers a build's reserved spots are held for, with buttons to
// reserve another and to copy the form's link for them. A spot someone has
// signed up with can't be removed: it's released if they cancel.
function Reservations({
  id,
  buildName,
  spots,
  full,
  locked,
  reservedEmails,
  formId,
  error,
  onChange,
}: {
  id: string;
  buildName: string;
  spots: ReservedSpot[];
  // Every spot is reserved.
  full: boolean;
  locked: boolean;
  reservedEmails: Set<string>;
  formId: string | null;
  error?: string;
  onChange: (spots: ReservedSpot[]) => void;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-reserved`} className="flex flex-col gap-2">
      {spots.length > 0 && (
        <ul aria-label={`Reserved spots at ${buildName}`} className="flex flex-wrap gap-2">
          {spots.map((spot) => (
            <li
              key={spot.email}
              className="flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-sm ring-1 ring-foreground/10"
            >
              <span className="font-medium">{spot.email}</span>
              {spot.signedUp ? (
                <Badge variant="secondary" className="mr-1">
                  Signed up
                </Badge>
              ) : (
                !locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onChange(spots.filter((other) => other.email !== spot.email))}
                    aria-label={`Remove the reserved spot for ${spot.email}`}
                  >
                    <XIcon />
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <ReserveDialog
            buildName={buildName}
            reservedEmails={reservedEmails}
            formId={formId}
            disabled={full}
            onReserve={(spot) => onChange([...spots, spot])}
          />
          {formId && spots.length > 0 && <FormLinkDialog path={`/signup/${formId}`} />}
        </div>
      )}
      {(locked || full) && (
        <p className="text-sm text-muted-foreground">
          {locked
            ? "The first build has started, so reserved spots can't change."
            : "Every spot is reserved. Add spots to reserve another."}
        </p>
      )}
      <FieldError field={`${id}-reservations`} error={error} />
    </div>
  );
}
