"use client";

import { cn } from "cn";
import { useActionState, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { ChoiceField, Field, Section, YesNoField } from "@/components/form-fields";
import { FormSections } from "@/components/form-sections";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { TShirtSize } from "@/generated/prisma/enums";
import type { SignupFormState } from "@/lib/form-signups/actions";
import type { DetailsField } from "@/lib/form-signups/details";
import { submitForm } from "@/lib/submit-form";
import { T_SHIRT_SIZES } from "@/lib/volunteers";

export type DetailsDefaults = {
  firstName: string;
  lastName: string;
  phone: string; // "(765) 555-0123"
  dateOfBirth: string; // "1990-05-17"
  tShirtSize: TShirtSize;
  hasDriversLicense: boolean;
};

export type ShiftChoice = {
  id: string;
  buildId: string;
  buildName: string;
  time: string; // "8:00 AM – 12:00 PM"
  notes: string | null;
};

type SignupFieldsProps = {
  action: (prev: SignupFormState, formData: FormData) => Promise<SignupFormState>;
  sections: { id: string; title: string; body: string }[];
  shifts: ShiftChoice[];
  // Saved details to start from, and the shifts already chosen.
  defaults: DetailsDefaults | null;
  chosenShiftIds: string[];
  submitLabel: string;
};

// The signup form itself, shown once the volunteer has confirmed their
// email. The server checks everything again (src/lib/form-signups).
export function SignupFields({
  action,
  sections,
  shifts,
  defaults,
  chosenShiftIds,
  submitLabel,
}: SignupFieldsProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  // Ignore earlier choices for shifts that aren't offered anymore.
  const [chosen, setChosen] = useState(
    () => new Set(chosenShiftIds.filter((id) => shifts.some((s) => s.id === id))),
  );

  function toggle(shiftId: string, on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(shiftId);
      else next.delete(shiftId);
      return next;
    });
  }

  const text = (
    field: Extract<DetailsField, "firstName" | "lastName" | "phone">,
    label: string,
    props: React.ComponentProps<"input">,
  ) => (
    <Field label={label} htmlFor={field} error={errors[field]}>
      <Input
        id={field}
        name={field}
        defaultValue={defaults?.[field] ?? ""}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
        required
        {...props}
      />
    </Field>
  );

  const builds = [...Map.groupBy(shifts, (shift) => shift.buildId).values()];

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-8">
      <FormSections sections={sections} />

      <Section title="Your information">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("firstName", "First name", { autoComplete: "given-name" })}
          {text("lastName", "Last name", { autoComplete: "family-name" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel", placeholder: "(765) 555-0123" })}
          <Field label="Birthday" htmlFor="dateOfBirth" error={errors.dateOfBirth}>
            <DatePicker
              id="dateOfBirth"
              name="dateOfBirth"
              defaultValue={defaults?.dateOfBirth}
              placeholder="Pick your birthday"
              birthday
              aria-invalid={errors.dateOfBirth ? true : undefined}
              aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined}
            />
          </Field>
          <ChoiceField
            field="tShirtSize"
            label="T-shirt size"
            options={T_SHIRT_SIZES}
            placeholder="Choose a size"
            defaultValue={defaults?.tShirtSize ?? null}
            error={errors.tShirtSize}
            optional={false}
          />
          <div className="sm:col-span-2">
            <YesNoField
              field="hasDriversLicense"
              label="Do you have a valid driver's license?"
              hint="We sometimes need volunteers who can drive others to the build site."
              defaultValue={defaults?.hasDriversLicense ?? null}
              error={errors.hasDriversLicense}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Shifts you could work"
        description="Choose every shift you'd be able to work. We'll place you on one of them and let you know."
      >
        {errors.shifts && (
          <p id="shifts-error" role="alert" className="text-sm text-destructive">
            {errors.shifts}
          </p>
        )}
        <div className="flex flex-col gap-5">
          {builds.map((buildShifts) => (
            <fieldset key={buildShifts[0].buildId} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{buildShifts[0].buildName}</legend>
              {buildShifts.map((shift) => {
                const checked = chosen.has(shift.id);
                return (
                  <label
                    key={shift.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 hover-gold rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50",
                      checked && "bg-muted/50 ring-2 ring-primary",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggle(shift.id, value)}
                      aria-describedby={errors.shifts ? "shifts-error" : undefined}
                      className="mt-0.5"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium">{shift.time}</span>
                      {shift.notes && (
                        <span className="text-sm whitespace-pre-line text-muted-foreground">
                          {shift.notes}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        {[...chosen].map((id) => (
          <input key={id} type="hidden" name="shiftId" value={id} />
        ))}
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
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
