"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { FieldError } from "@/components/field-error";
import { TimeSelect } from "@/components/time-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import type { BuildErrors } from "@/lib/form-builds";

export type BuildDefaults = {
  id: string; // empty for a new build
  name: string;
  address: string;
  startTime: string; // "08:00"
  endTime: string;
  capacity: string;
  description: string;
  lunch: string;
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
  cancelled: false,
  chosen: false,
};

// The builds on a signup form: where groups are working that day, which
// volunteers choose from. Sends one of each "build…" field per build, in
// order (see src/lib/form-builds.ts). A cancelled build keeps its fields,
// hidden, so they're sent unchanged. The inputs are uncontrolled and keyed,
// so removing a build doesn't move what's been typed into another.
export function BuildFields({
  defaults,
  errors,
}: {
  defaults: BuildDefaults[];
  errors: Record<number, BuildErrors>;
}) {
  const [builds, setBuilds] = useState(() =>
    defaults.map((build) => ({ ...build, key: crypto.randomUUID() })),
  );

  function add() {
    setBuilds((current) => [...current, { ...NEW_BUILD, key: crypto.randomUUID() }]);
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

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-capacity`}>Volunteer spots</Label>
                <NumberField
                  id={`${id}-capacity`}
                  name="buildSpots"
                  defaultValue={Number(build.capacity) || undefined}
                  min={1}
                  max={500}
                  {...aria("capacity")}
                />
                <FieldError field={`${id}-capacity`} error={buildErrors.capacity} />
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
