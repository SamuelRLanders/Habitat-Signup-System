"use client";

import { useActionState, useState } from "react";
import { DatePicker, MultiDatePicker } from "@/components/date-picker";
import { TimeSelect } from "@/components/time-select";
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
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import type { ShiftField, ShiftFormState } from "@/lib/builds/actions";
import { submitForm } from "@/lib/submit-form";
import { FieldError } from "../build-form";

type ShiftAction = (
  prev: ShiftFormState,
  formData: FormData,
) => Promise<ShiftFormState>;

type ShiftDialogProps = {
  action: ShiftAction;
  title: string;
  submitLabel: string;
  trigger: { label: string; variant?: "default" | "outline" | "ghost" };
  timeZoneLabel: string;
  // Adding: pick several dates, one new shift per date. Editing: one date.
  mode: "add" | "edit";
  defaults?: Record<ShiftField, string>;
  // Spots already taken, shown as a hint when editing.
  filled?: number;
};

export function ShiftDialog({ trigger, ...props }: ShiftDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={trigger.variant ?? "default"}
            size={trigger.variant === "default" ? "default" : "sm"}
          />
        }
      >
        {trigger.label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each opening starts fresh. */}
        <ShiftForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({
  action,
  title,
  submitLabel,
  timeZoneLabel,
  mode,
  defaults,
  filled,
  onSaved,
}: Omit<ShiftDialogProps, "trigger"> & { onSaved: () => void }) {
  const [dateCount, setDateCount] = useState(0);
  const [state, formAction, pending] = useActionState(
    async (prev: ShiftFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.success) onSaved();
      return result;
    },
    {},
  );
  const { errors = {} } = state;

  const initial = (field: ShiftField) => defaults?.[field] ?? "";

  const fieldProps = (field: ShiftField) => ({
    id: `shift-${field}`,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Times are in {timeZoneLabel} time.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        {mode === "add" ? (
          <>
            <Label htmlFor="shift-date">Dates</Label>
            <MultiDatePicker
              {...fieldProps("date")}
              disablePast
              onChange={(dates) => setDateCount(dates.length)}
            />
            <p className="text-sm text-muted-foreground">
              Each date gets its own copy of this shift, which you can edit
              separately later.
            </p>
          </>
        ) : (
          <>
            <Label htmlFor="shift-date">Date</Label>
            <DatePicker {...fieldProps("date")} defaultValue={initial("date")} />
          </>
        )}
        <FieldError field="date" error={errors.date} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="shift-startTime">Start time</Label>
          <TimeSelect {...fieldProps("startTime")} defaultValue={initial("startTime")} />
          <FieldError field="startTime" error={errors.startTime} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="shift-endTime">End time</Label>
          <TimeSelect {...fieldProps("endTime")} defaultValue={initial("endTime")} />
          <FieldError field="endTime" error={errors.endTime} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shift-capacity">Volunteer spots</Label>
        <NumberField
          {...fieldProps("capacity")}
          defaultValue={Number(initial("capacity")) || undefined}
          min={Math.max(1, filled ?? 0)}
          max={500}
        />
        {filled ? (
          <p className="text-sm text-muted-foreground">
            {filled} {filled === 1 ? "spot is" : "spots are"} already filled.
          </p>
        ) : null}
        <FieldError field="capacity" error={errors.capacity} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shift-notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          {...fieldProps("notes")}
          defaultValue={initial("notes")}
          rows={3}
          placeholder="e.g. Roofing day. Bring work gloves."
        />
        <FieldError field="notes" error={errors.notes} />
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "add" && dateCount > 1
              ? `Add ${dateCount} shifts`
              : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
