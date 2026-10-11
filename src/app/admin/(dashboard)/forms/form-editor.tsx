"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DatePicker } from "@/components/date-picker";
import { TimeSelect } from "@/components/time-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SignupFormField, SignupFormState } from "@/lib/signup-forms/actions";
import { submitForm } from "@/lib/submit-form";
import { FieldError } from "@/components/field-error";
import { BuildFields, NEW_BUILD, type BuildDefaults } from "./build-fields";
import { SectionFields, type SectionDefaults } from "./section-fields";

type AriaProps = { "aria-invalid"?: boolean; "aria-describedby"?: string };

type FormEditorProps = {
  action: (prev: SignupFormState, formData: FormData) => Promise<SignupFormState>;
  defaults?: Partial<Record<SignupFormField, string>>;
  // Left out for a new form, which starts with one empty build and asks
  // every optional question.
  builds?: BuildDefaults[];
  sections?: SectionDefaults[];
  submitLabel: string;
  cancelHref: string;
};

// Creating or editing a signup form: its name and day, when it's open, what
// it says, and the builds volunteers choose from.
export function FormEditor({
  action,
  defaults = {},
  builds = [NEW_BUILD],
  sections = [],
  submitLabel,
  cancelHref,
}: FormEditorProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, buildErrors = {}, sectionErrors = {} } = state;

  const aria = (field: SignupFormField): AriaProps => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <form onSubmit={submitForm(formAction)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults.name}
          placeholder="e.g. Purdue Habitat build day"
          autoComplete="off"
          {...aria("name")}
        />
        <p className="text-sm text-muted-foreground">
          Volunteers see it on the form and in their emails. Forms on the same
          day need different names.
        </p>
        <FieldError field="name" error={errors.name} />
      </div>

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
          A day can have more than one form, such as one for an outside group.
          Each form is separate, with its own builds and signups. Volunteers
          can only sign up on one form a day.
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

      <OptionSwitch
        name="listed"
        label="List on the home page"
        hint="Turn off for an outside group's form, so only people you share the link with can find it."
        defaultChecked={defaults.listed !== "no"}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">Optional questions</legend>
        <OptionSwitch
          name="askTransportation"
          label="Ask how volunteers are getting there"
          hint="Turn off for a group that's getting itself to the build. Volunteers won't be asked how they're getting there or for driver approval, and everyone counts as getting there on their own."
          defaultChecked={defaults.askTransportation !== "no"}
        />
        <OptionSwitch
          name="askGroups"
          label="Let volunteers ask to work with friends"
          hint="Only asked on a day with more than one build. Turning it off ignores requests volunteers have already made."
          defaultChecked={defaults.askGroups !== "no"}
        />
      </fieldset>

      <BuildFields defaults={builds} errors={buildErrors} />

      <SectionFields defaults={sections} errors={sectionErrors} />

      {(state.buildErrors || state.sectionErrors) && !errors.form && (
        <p role="alert" className="text-sm text-destructive">
          Some {state.buildErrors && state.sectionErrors ? "builds and sections" : state.buildErrors ? "builds" : "sections"}{" "}
          need another look. They&apos;re marked in red above.
        </p>
      )}

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

// A switch for one of the form's options, sent as "yes" or "no".
function OptionSwitch({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: SignupFormField;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={name}
        name={name}
        value="yes"
        uncheckedValue="no"
        defaultChecked={defaultChecked}
        aria-describedby={`${name}-hint`}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={name}>{label}</Label>
        <p id={`${name}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
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
