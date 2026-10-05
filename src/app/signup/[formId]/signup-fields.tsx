"use client";

import { CheckIcon, LockIcon } from "lucide-react";
import { cn } from "cn";
import { useActionState, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { ChoiceField, Field, YesNoField } from "@/components/form-fields";
import { LinkedText } from "@/components/linked-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TShirtSize } from "@/generated/prisma/enums";
import type { SignupFormState } from "@/lib/form-signups/actions";
import type { DetailsField, SignupField } from "@/lib/form-signups/details";
import { normalizeUsPhone } from "@/lib/phone";
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

// A build working that day. Each build has one shift a day, so volunteers
// choose builds; the ID is the shift's.
export type BuildChoice = {
  id: string;
  buildName: string;
  address: string;
  time: string; // "8:00 AM – 12:00 PM"
  notes: string | null;
};

type SignupFieldsProps = {
  action: (prev: SignupFormState, formData: FormData) => Promise<SignupFormState>;
  sections: { id: string; title: string; body: string }[];
  builds: BuildChoice[];
  // Saved details to start from, and the builds already chosen.
  defaults: DetailsDefaults | null;
  chosenIds: string[];
  // Changing an existing signup: every step starts out done.
  editing: boolean;
  submitLabel: string;
};

type Errors = Partial<Record<SignupField | "form", string>>;

const DETAIL_FIELDS: DetailsField[] = [
  "firstName",
  "lastName",
  "phone",
  "dateOfBirth",
  "tShirtSize",
  "hasDriversLicense",
];

// The signup form, shown once the volunteer has signed in with their email,
// as steps: their information, the builds they could work at, then each
// waiver. One step is open at a time; finished steps can be reopened, and
// later ones unlock as the volunteer continues. Every step's fields stay in
// the one form, so the last step's button submits them all. The server
// checks everything again (src/lib/form-signups).
export function SignupFields({
  action,
  sections,
  builds,
  defaults,
  chosenIds,
  editing,
  submitLabel,
}: SignupFieldsProps) {
  const steps = [
    { id: "info", title: "Your information" },
    { id: "builds", title: "Builds you could work at" },
    ...sections.map((section) => ({ id: `waiver-${section.id}`, title: section.title })),
  ];
  const last = steps.length - 1;

  const formRef = useRef<HTMLFormElement>(null);
  const [active, setActive] = useState(0);
  // The furthest step unlocked so far.
  const [reached, setReached] = useState(editing ? last : 0);
  const [name, setName] = useState(defaults ? `${defaults.firstName} ${defaults.lastName}` : "");
  // Problems found before submitting; after submitting, the server's.
  const [stepErrors, setStepErrors] = useState<Errors | null>(null);
  // Ignore earlier choices for builds that aren't offered anymore.
  const [chosen, setChosen] = useState(
    () => new Set(chosenIds.filter((id) => builds.some((b) => b.id === id))),
  );

  const [state, formAction, pending] = useActionState(
    async (prev: SignupFormState, formData: FormData) => {
      const result = await action(prev, formData);
      // Open the step with the first problem.
      const errors = result.errors ?? {};
      if (DETAIL_FIELDS.some((field) => errors[field])) open(0);
      else if (errors.shifts) open(1);
      return result;
    },
    {},
  );
  const errors: Errors = stepErrors ?? state.errors ?? {};

  function open(index: number) {
    setActive(index);
    // After the step expands, bring its top into view.
    requestAnimationFrame(() =>
      document.getElementById(`step-${steps[index].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  // Checks the open step's answers, then moves on to the next step.
  function next() {
    const values = new FormData(formRef.current!);
    const value = (field: string) => String(values.get(field) ?? "").trim();
    const problems: Errors = {};

    if (active === 0) {
      if (!value("firstName")) problems.firstName = "Enter your first name.";
      if (!value("lastName")) problems.lastName = "Enter your last name.";
      if (!normalizeUsPhone(value("phone"))) problems.phone = "Enter a 10-digit US phone number.";
      if (!value("dateOfBirth")) problems.dateOfBirth = "Enter your birthday.";
      if (!value("tShirtSize")) problems.tShirtSize = "Choose a T-shirt size.";
      if (!value("hasDriversLicense")) {
        problems.hasDriversLicense = "Tell us whether you have a driver's license.";
      }
      setName(`${value("firstName")} ${value("lastName")}`);
    } else if (active === 1 && chosen.size === 0) {
      problems.shifts = "Choose at least one build you could work at.";
    }

    setStepErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setReached((current) => Math.max(current, active + 1));
    open(active + 1);
  }

  function toggle(id: string) {
    setChosen((current) => {
      const updated = new Set(current);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  }

  const summaries: Record<string, string> = {
    info: name,
    builds: builds
      .filter((build) => chosen.has(build.id))
      .map((build) => build.buildName)
      .join(", "),
  };

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
        {...props}
      />
    </Field>
  );

  const actions = (index: number) =>
    index === last ? (
      <div className="flex flex-col gap-3">
        {errors.form && (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    ) : (
      <Button type="button" size="lg" onClick={next} className="w-full sm:w-fit">
        Continue
      </Button>
    );

  const step = (index: number, description: React.ReactNode, children: React.ReactNode) => (
    <Step
      key={steps[index].id}
      id={`step-${steps[index].id}`}
      number={index + 1}
      title={steps[index].title}
      description={description}
      summary={summaries[steps[index].id]}
      status={index === active ? "active" : index <= reached ? "done" : "locked"}
      onOpen={() => open(index)}
    >
      {children}
      {actions(index)}
    </Step>
  );

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        setStepErrors(null);
        submitForm(formAction)(event);
      }}
      onKeyDown={(event) => {
        // Enter in a field continues to the next step rather than submitting
        // the whole form early.
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && active < last) {
          event.preventDefault();
          next();
        }
      }}
      className="flex flex-col gap-6"
    >
      {step(
        0,
        defaults
          ? "Filled in from your last signup. Change anything that's out of date."
          : "So we know who's coming and can reach you on the build day.",
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
        </div>,
      )}

      {step(
        1,
        "Choose every build you'd be able to work at. We'll place you at one of them and let you know.",
        <>
          {errors.shifts && (
            <p id="shifts-error" role="alert" className="text-sm text-destructive">
              {errors.shifts}
            </p>
          )}
          <div role="group" aria-label="Builds" className="flex flex-col gap-2">
            {builds.map((build) => {
              const checked = chosen.has(build.id);
              return (
                <button
                  key={build.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-describedby={errors.shifts ? "shifts-error" : undefined}
                  onClick={() => toggle(build.id)}
                  className={cn(
                    "flex items-center gap-3 hover-gold rounded-full border px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border",
                      checked
                        ? "border-primary-foreground bg-primary-foreground text-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {checked && <CheckIcon className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{build.buildName}</span>
                    <span className={cn("text-sm", checked ? "opacity-85" : "text-muted-foreground")}>
                      {build.time} · {build.address}
                    </span>
                    {build.notes && (
                      <span className={cn("text-sm", checked ? "opacity-85" : "text-muted-foreground")}>
                        {build.notes}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {[...chosen].map((id) => (
            <input key={id} type="hidden" name="shiftId" value={id} />
          ))}
        </>,
      )}

      {sections.map((section, i) =>
        step(
          i + 2,
          "Read this and complete the waiver before the build day.",
          <p className="text-sm whitespace-pre-line">
            <LinkedText text={section.body} />
          </p>,
        ),
      )}
    </form>
  );
}

// One step of the form. Only the open step shows its fields; the others
// keep theirs in the form, hidden. A finished step shows a short summary
// and opens again when clicked; a step not reached yet is locked.
function Step({
  id,
  number,
  title,
  description,
  summary,
  status,
  onOpen,
  children,
}: {
  id: string;
  number: number;
  title: string;
  description: React.ReactNode;
  summary?: string;
  status: "active" | "done" | "locked";
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const active = status === "active";
  const marker = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        active ? "bg-gold text-black" : status === "done" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {status === "done" ? <CheckIcon className="size-4" /> : number}
    </span>
  );

  return (
    <section
      id={id}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex scroll-mt-4 flex-col gap-4 rounded-3xl p-5 transition-colors sm:p-6",
        active ? "bg-card ring-2 ring-gold" : "bg-muted/40 ring-1 ring-foreground/5",
      )}
    >
      {active ? (
        <div className="flex items-start gap-3">
          {marker}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={status === "locked"}
          className="flex items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-2xl disabled:cursor-not-allowed"
        >
          {marker}
          <span className={cn("flex min-w-0 flex-1 flex-col", status === "locked" && "opacity-60")}>
            <span className="font-semibold">{title}</span>
            <span className="truncate text-sm text-muted-foreground">
              {status === "done" ? summary || "Done" : "Finish the steps above first"}
            </span>
          </span>
          {status === "done" ? (
            <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium hover-gold">
              Edit
            </span>
          ) : (
            <LockIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      )}
      <div className={active ? "flex flex-col gap-5" : "hidden"}>{children}</div>
    </section>
  );
}
