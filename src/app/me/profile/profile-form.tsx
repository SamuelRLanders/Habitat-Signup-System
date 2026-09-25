"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ProfileFields, type ProfileDefaults } from "@/components/profile-fields";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/me/actions";
import { submitForm } from "@/lib/submit-form";

export function ProfileForm({ defaults }: { defaults: ProfileDefaults | null }) {
  // Saving refreshes the page, which passes the saved details back in. The
  // fields already show them, and changing an uncontrolled field's default
  // after it loads makes Base UI warn, so keep the first ones.
  const [initialDefaults] = useState(defaults);
  const [state, formAction, pending] = useActionState(updateProfile, {});
  const errors = state.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed save, move to the first field with a problem.
  useEffect(() => {
    if (state.errors) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submitForm(formAction)}
      className="flex flex-col gap-10"
    >
      <ProfileFields errors={errors} defaults={initialDefaults} />
      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
        <p role="status" className="text-sm empty:hidden">
          {state.success && !pending && "Saved."}
          {state.errors && (
            <span className="text-destructive">
              {errors.form ?? "Some answers need another look. They're marked in red above."}
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
