"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BuildField, BuildFormState } from "@/lib/builds/actions";
import { submitForm } from "@/lib/submit-form";
import { DEFAULT_TIME_ZONE, TIME_ZONES } from "@/lib/time";

type BuildFormProps = {
  action: (prev: BuildFormState, formData: FormData) => Promise<BuildFormState>;
  defaults?: Record<BuildField, string>;
  submitLabel: string;
  cancelHref: string;
  // Shown under the time zone field when editing a build that has shifts.
  hasShifts?: boolean;
};

export function BuildForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hasShifts,
}: BuildFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {} } = state;

  const value = (field: BuildField) => defaults?.[field] ?? "";

  const fieldProps = (field: BuildField) => ({
    id: field,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          {...fieldProps("name")}
          defaultValue={value("name")}
          placeholder="e.g. The Johnson Family Home"
          required
        />
        <FieldError field="name" error={errors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Input
          {...fieldProps("address")}
          defaultValue={value("address")}
          placeholder="123 Main St, Lafayette, IN 47901"
          autoComplete="off"
          required
        />
        <FieldError field="address" error={errors.address} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          {...fieldProps("description")}
          defaultValue={value("description")}
          rows={4}
          placeholder="Anything volunteers should know about this build."
        />
        <FieldError field="description" error={errors.description} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timeZone">Time zone</Label>
        <Select
          name="timeZone"
          items={TIME_ZONES}
          defaultValue={defaults?.timeZone ?? DEFAULT_TIME_ZONE}
        >
          <SelectTrigger
            id="timeZone"
            aria-invalid={errors.timeZone ? true : undefined}
            aria-describedby={errors.timeZone ? "timeZone-error" : undefined}
            className="w-full sm:w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_ZONES.map((zone) => (
              <SelectItem key={zone.value} value={zone.value}>
                {zone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Shift times are entered and shown in this time zone.
          {hasShifts &&
            " If you change it, existing shifts keep their clock times."}
        </p>
        <FieldError field="timeZone" error={errors.timeZone} />
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function FieldError({ field, error }: { field: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${field}-error`} className="text-sm text-destructive">
      {error}
    </p>
  );
}
