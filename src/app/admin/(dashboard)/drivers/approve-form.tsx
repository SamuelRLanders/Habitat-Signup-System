"use client";

import { useActionState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import type { ApproveDriverState } from "@/lib/drivers/actions";
import { submitForm } from "@/lib/submit-form";

// The last day of a pending driver's approval, filled in with a year after
// they filled out Purdue's form, and the Approve button.
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
  const error = state.errors?.approvedUntil ?? state.errors?.form;

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-1">
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
  );
}
