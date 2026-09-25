"use client";

import { cn } from "cn";
import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CopyLink } from "@/components/copy-link";
import { Field, Section } from "@/components/form-fields";
import { ProfileFields, type ProfileDefaults } from "@/components/profile-fields";
import { WaiverSignature } from "@/components/waiver-signature";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import type { SignupFormState } from "@/lib/signups/actions";
import { submitForm } from "@/lib/submit-form";
import { MAX_GROUP_SIZE, spotsText } from "@/lib/volunteers";

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
  waiver: { id: string; title: string; body: string };
  defaults: ProfileDefaults | null;
};

export function SignupForm({
  action,
  shifts,
  timeZoneLabel,
  waiver,
  defaults,
}: SignupFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, shiftErrors = {} } = state;
  const formRef = useRef<HTMLFormElement>(null);

  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // With saved details, show a summary instead of the fields.
  const [editingProfile, setEditingProfile] = useState(defaults === null);

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
            label="Group name"
            htmlFor="groupName"
            error={errors.groupName}
            hint="For example, “First Baptist Youth Group”."
            optional
          >
            <Input
              id="groupName"
              name="groupName"
              autoComplete="off"
              aria-invalid={errors.groupName ? true : undefined}
              aria-describedby={errors.groupName ? "groupName-error" : undefined}
            />
          </Field>
        )}

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

      {editingProfile ? (
        <>
          <input type="hidden" name="editProfile" value="on" />
          <ProfileFields
            errors={errors}
            defaults={defaults}
            description={
              isGroup ? "As the group's contact, enter your own details." : undefined
            }
          />
        </>
      ) : (
        defaults && (
          <SavedDetails defaults={defaults} onChange={() => setEditingProfile(true)} />
        )
      )}

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

      <Section
        title="Waiver"
        description={
          isGroup
            ? "This waiver is for you. After you sign up, you'll get a link to send your group so each person can sign their own."
            : "Please read the waiver, then type your full legal name to agree to it."
        }
      >
        <WaiverSignature
          waiver={waiver}
          field="signedName"
          error={errors.signedName}
        />
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

// The volunteer's saved details, with a button to change them for this
// signup (which also updates what's saved).
function SavedDetails({
  defaults,
  onChange,
}: {
  defaults: ProfileDefaults;
  onChange: () => void;
}) {
  return (
    <Section title="Your details">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Name</dt>
          <dd>
            {defaults.firstName} {defaults.lastName}
          </dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{defaults.phone}</dd>
          <dt className="text-muted-foreground">Emergency contact</dt>
          <dd>
            {defaults.emergencyContactName}, {defaults.emergencyContactPhone}
          </dd>
        </dl>
        <Button type="button" variant="outline" size="sm" onClick={onChange}>
          Change
        </Button>
      </div>
    </Section>
  );
}

function Confirmation({
  email,
  groupSize,
  shifts,
  waiverPath,
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
      {waiverPath && (
        <div className="flex flex-col gap-3 rounded-lg bg-background p-4 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">Next: send your group the waiver link</h3>
            <p className="text-sm text-muted-foreground">
              Everyone else in your group needs to sign the waiver before the
              build. Send them this link. You can see who has signed on your
              signups page.
            </p>
          </div>
          <CopyLink path={waiverPath} label="Group waiver link" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        We&apos;ve emailed a confirmation to {email}.
      </p>
      <Link href="/me" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
        View your signups
      </Link>
    </div>
  );
}
