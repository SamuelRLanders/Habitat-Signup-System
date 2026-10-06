"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DatePicker } from "@/components/date-picker";
import { TimeSelect } from "@/components/time-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SignupFormField, SignupFormState } from "@/lib/signup-forms/actions";
import { submitForm } from "@/lib/submit-form";
import { FieldError } from "../builds/build-form";
import { SectionFields, type SectionDefaults } from "./section-fields";

type AriaProps = { "aria-invalid"?: boolean; "aria-describedby"?: string };

type FormEditorProps = {
  action: (prev: SignupFormState, formData: FormData) => Promise<SignupFormState>;
  defaults?: Partial<Record<SignupFormField, string>>;
  sections?: SectionDefaults[];
  submitLabel: string;
  cancelHref: string;
};

// Creating or editing a signup form: its day, when it's open, and what it
// says. The shifts aren't chosen here: the form offers every shift on its day.
export function FormEditor({
  action,
  defaults = {},
  sections = [],
  submitLabel,
  cancelHref,
}: FormEditorProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, sectionErrors = {} } = state;

  const aria = (field: SignupFormField): AriaProps => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Event day</Label>
        <DatePicker
          id="date"
          name="date"
          defaultValue={defaults.date}
          disablePast
          {...aria("date")}
        />
        <p className="text-sm text-muted-foreground">
          The form offers every build on this day. Each event has one
          form.
        </p>
        <FieldError field="date" error={errors.date} />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">When volunteers can fill it out</legend>
        <DateTimeFields
          label="Opens"
          dateField="opensDate"
          timeField="opensTime"
          defaults={defaults}
          errors={errors}
          aria={aria}
        />
        <DateTimeFields
          label="Closes"
          dateField="closesDate"
          timeField="closesTime"
          defaults={defaults}
          errors={errors}
          aria={aria}
        />
        <p className="text-sm text-muted-foreground">
          Times are in Eastern (Indiana) time. Once the form is published,
          volunteers can see it right away, but can only fill it out while
          it&apos;s open. It has to close by the end of the event day.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          rows={4}
          placeholder="Anything volunteers should know about the day, such as where to meet."
          {...aria("description")}
        />
        <FieldError field="description" error={errors.description} />
      </div>

      <SectionFields defaults={sections} errors={sectionErrors} />

      {state.sectionErrors && !errors.form && (
        <p role="alert" className="text-sm text-destructive">
          Some sections need another look. They&apos;re marked in red above.
        </p>
      )}

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

// A day and a time side by side, such as when the form opens.
function DateTimeFields({
  label,
  dateField,
  timeField,
  defaults,
  errors,
  aria,
}: {
  label: string;
  dateField: SignupFormField;
  timeField: SignupFormField;
  defaults: Partial<Record<SignupFormField, string>>;
  errors: NonNullable<SignupFormState["errors"]>;
  aria: (field: SignupFormField) => AriaProps;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={dateField}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
        <DatePicker
          id={dateField}
          name={dateField}
          defaultValue={defaults[dateField]}
          {...aria(dateField)}
        />
        <TimeSelect
          id={timeField}
          name={timeField}
          defaultValue={defaults[timeField]}
          aria-label={`${label} at`}
          {...aria(timeField)}
        />
      </div>
      <FieldError field={dateField} error={errors[dateField]} />
      <FieldError field={timeField} error={errors[timeField]} />
    </div>
  );
}
