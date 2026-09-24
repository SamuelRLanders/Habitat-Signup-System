"use client";

import { cn } from "cn";
import { CheckCircle2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SignupField, SignupFormState } from "@/lib/signups/actions";
import { submitForm } from "@/lib/submit-form";
import { MAX_GROUP_SIZE, SEX_OPTIONS, T_SHIRT_SIZES } from "@/lib/volunteers";

export type ShiftOption = {
  id: string;
  date: string; // "Sat, Oct 10, 2026"
  time: string; // "8:00 AM – 12:00 PM"
  spotsLeft: number;
  notes: string | null;
};

type SignupFormProps = {
  action: (prev: SignupFormState, formData: FormData) => Promise<SignupFormState>;
  shifts: ShiftOption[];
  timeZoneLabel: string;
};

export function SignupForm({ action, shifts, timeZoneLabel }: SignupFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, shiftErrors = {} } = state;
  const formRef = useRef<HTMLFormElement>(null);

  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // After a failed submission, move to the first field with a problem.
  useEffect(() => {
    if (state.errors) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  if (state.success) return <Confirmation {...state.success} />;

  const spotsNeeded = isGroup ? groupSize : 1;
  const fits = (shift: ShiftOption) => shift.spotsLeft >= spotsNeeded;
  // Shifts too small for the group are unticked in effect, not just greyed.
  const chosen = shifts.filter((s) => selected.has(s.id) && fits(s));

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const text = (field: SignupField, label: string, props: React.ComponentProps<"input"> = {}) => (
    <Field label={label} htmlFor={field} error={errors[field]}>
      <Input
        id={field}
        name={field}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
        required
        {...props}
      />
    </Field>
  );

  const days = Map.groupBy(shifts, (shift) => shift.date);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submitForm(formAction)}
      className="flex flex-col gap-10"
    >
      <Section title="Who's signing up?">
        <div
          role="radiogroup"
          aria-label="Who's signing up"
          className="flex w-fit gap-1 rounded-full bg-muted p-1"
        >
          {(
            [
              ["individual", "Just me"],
              ["group", "A group"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="signupType"
                value={value}
                checked={isGroup === (value === "group")}
                onChange={() => setIsGroup(value === "group")}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>

        {isGroup && (
          <Field
            label="How many people are in your group, including you?"
            htmlFor="groupSize"
            error={errors.groupSize}
            hint="Everyone in the group must be 18 or older."
          >
            <NumberField
              id="groupSize"
              name="groupSize"
              defaultValue={2}
              min={2}
              max={MAX_GROUP_SIZE}
              onValueChange={(value) => setGroupSize(value ?? 2)}
              aria-invalid={errors.groupSize ? true : undefined}
              aria-describedby={errors.groupSize ? "groupSize-error" : undefined}
            />
          </Field>
        )}
      </Section>

      <Section
        title="Your information"
        description={
          isGroup
            ? "As the group's contact, enter your own details."
            : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {text("firstName", "First name", { autoComplete: "given-name" })}
          {text("lastName", "Last name", { autoComplete: "family-name" })}
          {text("email", "Email", { type: "email", autoComplete: "email" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel", placeholder: "(765) 555-0123" })}
          <div className="sm:col-span-2">
            {text("address", "Home address", {
              autoComplete: "street-address",
              placeholder: "123 Main St, Lafayette, IN 47901",
            })}
          </div>
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
          <div className="hidden sm:block" />
          <ChoiceField
            field="sex"
            label="Sex"
            options={SEX_OPTIONS}
            placeholder="Prefer not to say"
            error={errors.sex}
          />
          <ChoiceField
            field="tShirtSize"
            label="T-shirt size"
            options={T_SHIRT_SIZES}
            placeholder="Choose a size"
            error={errors.tShirtSize}
          />
        </div>
      </Section>

      <Section title="Emergency contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("emergencyContactName", "Name", { autoComplete: "off" })}
          {text("emergencyContactPhone", "Phone", { type: "tel", autoComplete: "off" })}
        </div>
      </Section>

      <Section
        title="Choose your shifts"
        description={`Pick as many as you like. Times are in ${timeZoneLabel} time.`}
      >
        {errors.shifts && (
          <p id="shifts-error" role="alert" className="text-sm text-destructive">
            {errors.shifts}
          </p>
        )}
        <div className="flex flex-col gap-5">
          {[...days].map(([date, dayShifts]) => (
            <fieldset key={date} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">
                {date}
              </legend>
              {dayShifts.map((shift) => {
                const available = fits(shift);
                const checked = selected.has(shift.id) && available;
                const problem = shiftErrors[shift.id];
                return (
                  <label
                    key={shift.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors",
                      available ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60",
                      checked && "bg-muted/50 ring-2 ring-primary",
                      problem && "ring-2 ring-destructive",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!available}
                      onCheckedChange={(value) => toggle(shift.id, value)}
                      aria-invalid={problem ? true : undefined}
                      className="mt-0.5"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className="font-medium">{shift.time}</span>
                        <span className="text-sm text-muted-foreground">
                          {spotsText(shift.spotsLeft)}
                        </span>
                      </span>
                      {shift.notes && (
                        <span className="text-sm whitespace-pre-line text-muted-foreground">
                          {shift.notes}
                        </span>
                      )}
                      {!available && shift.spotsLeft > 0 && (
                        <span className="text-sm">Not enough spots for your group.</span>
                      )}
                      {problem && <span className="text-sm text-destructive">{problem}</span>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        {chosen.map((shift) => (
          <input key={shift.id} type="hidden" name="shiftId" value={shift.id} />
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
          {pending
            ? "Signing up…"
            : chosen.length > 1
              ? `Sign up for ${chosen.length} shifts`
              : "Sign up"}
        </Button>
      </div>
    </form>
  );
}

function spotsText(spotsLeft: number) {
  if (spotsLeft === 0) return "Full";
  return `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceField({
  field,
  label,
  options,
  placeholder,
  error,
}: {
  field: SignupField;
  label: string;
  options: { value: string; label: string }[];
  placeholder: string;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={field} error={error} optional>
      <Select name={field} items={options} defaultValue={null}>
        <SelectTrigger
          id={field}
          aria-invalid={error ? true : undefined}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Confirmation({
  groupSize,
  shifts,
}: NonNullable<SignupFormState["success"]>) {
  const ref = useRef<HTMLDivElement>(null);

  // The form was long and the submit button was at its bottom, so bring the
  // confirmation into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={ref} role="status" className="flex flex-col gap-6 rounded-xl bg-muted/50 p-6 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-2">
        <CheckCircle2Icon className="size-8 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">You&apos;re signed up!</h2>
        <p className="text-muted-foreground">
          {groupSize > 1
            ? `Thanks for bringing a group of ${groupSize}. You're signed up for:`
            : "Thanks for volunteering. You're signed up for:"}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-lg bg-background p-3 ring-1 ring-foreground/10">
            <span className="font-medium">{shift.date}</span>
            <span className="block text-sm text-muted-foreground">{shift.time}</span>
          </li>
        ))}
      </ul>
      {/* A full page load resets the form. */}
      <a href="" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
        Sign up someone else
      </a>
    </div>
  );
}
