"use client";

import { startTransition, useActionState, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { EmailWarning } from "@/components/email-warning";
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
import type { ApproveDriverState } from "@/lib/drivers/actions";
import { formatDay } from "@/lib/time";

// The last day of a pending driver's approval, filled in with a year after
// they filled out Purdue's form, and the Approve button. Approving emails
// the driver, so the admin confirms that first.
export function ApproveForm({
  action,
  suggestedUntil,
  name,
}: {
  action: (prev: ApproveDriverState, formData: FormData) => Promise<ApproveDriverState>;
  suggestedUntil: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // The answers waiting on the confirmation. Like submitForm, this keeps
  // React from clearing the form.
  const [confirming, setConfirming] = useState<FormData | null>(null);
  const error = state.errors?.approvedUntil ?? state.errors?.form;
  const until = confirming?.get("approvedUntil");

  function approve() {
    const formData = confirming!;
    setConfirming(null);
    startTransition(() => formAction(formData));
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setConfirming(new FormData(event.currentTarget));
        }}
        className="flex flex-col gap-1"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <DatePicker
              name="approvedUntil"
              defaultValue={suggestedUntil}
              disablePast
              aria-label={`Approve ${name} through`}
              aria-invalid={error ? true : undefined}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Approving…" : "Approve"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {name} as a driver?</DialogTitle>
            <DialogDescription>
              They&apos;ll be able to offer rides on signup forms
              {typeof until === "string" && until ? ` through ${formatDay(until)}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <EmailWarning>This emails {name} to tell them they&apos;re an approved driver.</EmailWarning>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Never mind</DialogClose>
            <Button onClick={approve}>Approve and email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
