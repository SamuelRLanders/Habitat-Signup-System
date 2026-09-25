"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Field, Section } from "@/components/form-fields";
import { WaiverSignature } from "@/components/waiver-signature";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { MemberWaiverState } from "@/lib/waivers/actions";
import { submitForm } from "@/lib/submit-form";

type Action = (prev: MemberWaiverState, formData: FormData) => Promise<MemberWaiverState>;

export function MemberWaiverForm({
  action,
  waiver,
  buildName,
}: {
  action: Action;
  waiver: { id: string; title: string; body: string };
  buildName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  const [smsOptIn, setSmsOptIn] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submission, move to the first field with a problem.
  useEffect(() => {
    if (state.errors) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  if (state.success) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl bg-muted/50 p-6 ring-1 ring-foreground/10">
        <CheckCircle2Icon className="size-8 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
        <p className="text-muted-foreground">
          Thanks, {state.signedName}. You&apos;ve signed the waiver for{" "}
          {buildName}. See you at the build.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submitForm(formAction)}
      className="flex flex-col gap-10"
    >
      <Section title="Your details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Birthday" htmlFor="dateOfBirth" error={errors.dateOfBirth}>
            <DatePicker
              id="dateOfBirth"
              name="dateOfBirth"
              placeholder="Pick your birthday"
              birthday
              aria-invalid={errors.dateOfBirth ? true : undefined}
              aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(765) 555-0123"
              required
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "phone-error" : undefined}
            />
          </Field>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <Checkbox checked={smsOptIn} onCheckedChange={setSmsOptIn} className="mt-0.5" />
            <span>
              Text me updates about the build, including on build days.{" "}
              <span className="text-muted-foreground">
                Message and data rates may apply. Reply STOP to opt out.
              </span>
            </span>
          </label>
          {smsOptIn && <input type="hidden" name="smsOptIn" value="on" />}
        </div>
      </Section>

      <Section title="Waiver" description="Please read the waiver, then type your full legal name to agree to it.">
        <WaiverSignature waiver={waiver} field="legalName" error={errors.legalName} />
      </Section>

      <div className="flex flex-col gap-3 border-t pt-6">
        {errors.form && (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        )}
        {state.errors && !errors.form && (
          <p role="alert" className="text-sm text-destructive">
            Some answers need another look. They&apos;re marked in red above.
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Signing…" : "Sign waiver"}
        </Button>
      </div>
    </form>
  );
}
