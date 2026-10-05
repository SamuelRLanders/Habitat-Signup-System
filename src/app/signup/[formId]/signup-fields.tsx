"use client";

import { CheckIcon, ExternalLinkIcon, LockIcon } from "lucide-react";
import { cn } from "cn";
import { useActionState, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { ChoiceField, Field, YesNoField } from "@/components/form-fields";
import { LinkedText } from "@/components/linked-text";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import type { Transportation, TShirtSize } from "@/generated/prisma/enums";
import type { SignupFormState } from "@/lib/form-signups/actions";
import type { DetailsField, SignupField } from "@/lib/form-signups/details";
import { normalizeUsPhone } from "@/lib/phone";
import { submitForm } from "@/lib/submit-form";
import { formatDay } from "@/lib/time";
import {
  DRIVER_APPROVAL_URL,
  seatsLabel,
  T_SHIRT_SIZES,
  TRANSPORTATION_OPTIONS,
  type DriverStatus,
} from "@/lib/volunteers";

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
  // Saved details to start from.
  defaults: DetailsDefaults | null;
  // The volunteer's driver approval, and their car's seats if they've
  // given them before.
  driver: DriverStatus;
  savedCarSeats: number | null;
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

// Which step each problem the server finds belongs to.
const ERROR_STEPS: [SignupField, string][] = [
  ...DETAIL_FIELDS.map((field): [SignupField, string] => [field, "info"]),
  ["shifts", "builds"],
  ["driverForm", "driver"],
  ["transportation", "transport"],
  ["carSeats", "car"],
];

// The signup form, shown once the volunteer has signed in with their email,
// as steps: their information, the builds they could work at, driver
// approval (if they have a license), how they're getting there, their car
// (if they'll drive others), then each waiver. One step is open at a time;
// finished steps can be reopened, and a step unlocks once every step before
// it is done. Every step's fields stay in the one form, so the last step's
// button submits them all. The server checks everything again
// (src/lib/form-signups).
export function SignupFields({
  action,
  sections,
  builds,
  defaults,
  driver,
  savedCarSeats,
}: SignupFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [license, setLicense] = useState(defaults?.hasDriversLicense ?? null);
  const [driverForm, setDriverForm] = useState<"done" | "not-done" | null>(null);
  const [transport, setTransport] = useState<Transportation | null>(null);
  const [seats, setSeats] = useState(savedCarSeats);
  const [editingSeats, setEditingSeats] = useState(savedCarSeats === null);
  const [name, setName] = useState(defaults ? `${defaults.firstName} ${defaults.lastName}` : "");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());

  // Only drivers who are approved or waiting for approval (counting a
  // "yes" just now) can offer to drive others.
  const canDrive = license === true && (driver.status !== "none" || driverForm === "done");
  const transportChoice = transport === "CAN_DRIVE" && !canDrive ? null : transport;

  const steps = [
    { id: "info", title: "Your information" },
    { id: "builds", title: "Builds you could work at" },
    ...(license ? [{ id: "driver", title: "Driver approval" }] : []),
    { id: "transport", title: "Getting to the site" },
    ...(transportChoice === "CAN_DRIVE" ? [{ id: "car", title: "Your car" }] : []),
    ...sections.map((section) => ({ id: `waiver-${section.id}`, title: section.title })),
  ];
  const lastId = steps[steps.length - 1].id;

  const [active, setActive] = useState("info");
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // Problems found before submitting; after submitting, the server's.
  const [stepErrors, setStepErrors] = useState<Errors | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: SignupFormState, formData: FormData) => {
      const result = await action(prev, formData);
      // Open the step with the first problem.
      const errors = result.errors ?? {};
      const step = ERROR_STEPS.find(([field]) => errors[field])?.[1];
      if (step) open(step);
      return result;
    },
    {},
  );
  const errors: Errors = stepErrors ?? state.errors ?? {};

  function open(id: string) {
    setActive(id);
    // After the step expands, bring its top into view.
    requestAnimationFrame(() =>
      document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  // Checks the open step's answers, then moves on to the next step.
  function next() {
    const values = new FormData(formRef.current!);
    const value = (field: string) => String(values.get(field) ?? "").trim();
    const problems: Errors = {};

    if (active === "info") {
      if (!value("firstName")) problems.firstName = "Enter your first name.";
      if (!value("lastName")) problems.lastName = "Enter your last name.";
      if (!normalizeUsPhone(value("phone"))) problems.phone = "Enter a 10-digit US phone number.";
      if (!value("dateOfBirth")) problems.dateOfBirth = "Enter your birthday.";
      if (!value("tShirtSize")) problems.tShirtSize = "Choose a T-shirt size.";
      if (!value("hasDriversLicense")) {
        problems.hasDriversLicense = "Tell us whether you have a driver's license.";
      }
      setName(`${value("firstName")} ${value("lastName")}`);
    } else if (active === "builds" && chosen.size === 0) {
      problems.shifts = "Choose at least one build you could work at.";
    } else if (active === "driver" && driver.status === "none" && !driverForm) {
      problems.driverForm = "Tell us whether you've filled out the driver approval form.";
    } else if (active === "transport" && !transportChoice) {
      problems.transportation = "Tell us how you're getting to the build site.";
    } else if (active === "car" && seats === null) {
      problems.carSeats = "Tell us how many seats your car has.";
    }

    setStepErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setDone((current) => new Set(current).add(active));
    const index = steps.findIndex((step) => step.id === active);
    open(steps[index + 1].id);
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
    driver:
      driver.status === "approved"
        ? `Approved through ${formatDay(driver.until, "short")}`
        : driver.status === "pending"
          ? "Approval pending"
          : driverForm === "done"
            ? "You filled out the form"
            : "Not filled out yet",
    transport: TRANSPORTATION_OPTIONS.find((o) => o.value === transportChoice)?.label ?? "",
    car: seats === null ? "" : seatsLabel(seats),
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

  const error = (field: SignupField) =>
    errors[field] && (
      <p id={`${field}-error`} role="alert" className="text-sm text-destructive">
        {errors[field]}
      </p>
    );

  const step = (id: string, description: React.ReactNode, children: React.ReactNode) => {
    const index = steps.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const unlocked = steps.slice(0, index).every((s) => done.has(s.id));
    return (
      <Step
        key={id}
        id={`step-${id}`}
        number={index + 1}
        title={steps[index].title}
        description={description}
        summary={summaries[id]}
        status={id === active ? "active" : unlocked && done.has(id) ? "done" : "locked"}
        onOpen={() => open(id)}
      >
        {children}
        {id === lastId ? (
          <div className="flex flex-col gap-3">
            {errors.form && (
              <p role="alert" className="text-sm text-destructive">
                {errors.form}
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
              {pending ? "Signing up…" : "Sign up"}
            </Button>
          </div>
        ) : (
          <Button type="button" size="lg" onClick={next} className="w-full sm:w-fit">
            Continue
          </Button>
        )}
      </Step>
    );
  };

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
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && active !== lastId) {
          event.preventDefault();
          next();
        }
      }}
      className="flex flex-col gap-6"
    >
      {step(
        "info",
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
              onChange={setLicense}
            />
          </div>
        </div>,
      )}

      {step(
        "builds",
        "Choose every build you'd be able to work at. We'll place you at one of them and let you know.",
        <>
          {error("shifts")}
          <div role="group" aria-label="Builds" className="flex flex-col gap-2">
            {builds.map((build) => (
              <ChoicePill
                key={build.id}
                role="checkbox"
                checked={chosen.has(build.id)}
                onClick={() => toggle(build.id)}
                describedBy={errors.shifts ? "shifts-error" : undefined}
                title={build.buildName}
                lines={[`${build.time} · ${build.address}`, build.notes]}
              />
            ))}
          </div>
          {[...chosen].map((id) => (
            <input key={id} type="hidden" name="shiftId" value={id} />
          ))}
        </>,
      )}

      {step(
        "driver",
        "Drivers have to be approved by Purdue to help us drive.",
        driver.status === "approved" ? (
          <p className="text-sm">
            You&apos;re an approved Purdue driver through{" "}
            <strong>{formatDay(driver.until)}</strong>. Thanks!
          </p>
        ) : driver.status === "pending" ? (
          <p className="text-sm">
            Your driver approval is pending. If you haven&apos;t finished{" "}
            <a href={DRIVER_APPROVAL_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Purdue&apos;s driver approval form
            </a>
            , please do.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Please fill out Purdue&apos;s driver approval form so you can be
                approved to drive for us. Even if you don&apos;t have a car,
                it&apos;s worth doing: we sometimes need several approved
                drivers in one car. Being approved also makes you more likely
                to be placed on high-demand builds.
              </p>
            </div>
            <a
              href={DRIVER_APPROVAL_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", className: "w-fit" })}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              Open the driver approval form
            </a>
            {error("driverForm")}
            <div role="radiogroup" aria-label="Driver approval form" className="flex flex-col gap-2">
              <ChoicePill
                role="radio"
                checked={driverForm === "done"}
                onClick={() => setDriverForm("done")}
                title="I've filled out the form"
              />
              <ChoicePill
                role="radio"
                checked={driverForm === "not-done"}
                onClick={() => setDriverForm("not-done")}
                title="I haven't filled it out"
              />
            </div>
            {driverForm && <input type="hidden" name="driverForm" value={driverForm} />}
          </>
        ),
      )}

      {step(
        "transport",
        "How are you getting to the build site?",
        <>
          {error("transportation")}
          <div role="radiogroup" aria-label="Getting to the site" className="flex flex-col gap-2">
            {TRANSPORTATION_OPTIONS.filter((option) => option.value !== "CAN_DRIVE" || canDrive).map(
              (option) => (
                <ChoicePill
                  key={option.value}
                  role="radio"
                  checked={transportChoice === option.value}
                  onClick={() => setTransport(option.value)}
                  title={option.label}
                />
              ),
            )}
          </div>
          {transportChoice && <input type="hidden" name="transportation" value={transportChoice} />}
        </>,
      )}

      {step(
        "car",
        "So we know how many volunteers you could drive.",
        <>
          {error("carSeats")}
          {!editingSeats && seats !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                {seats === 0
                  ? "You told us you don't have a car of your own."
                  : `You're registered with a car with ${seats} ${seats === 1 ? "seat" : "seats"}.`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingSeats(true)}>
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="carSeats">How many seats does your car have, counting yours?</Label>
                <NumberField
                  id="carSeats"
                  value={seats && seats > 0 ? seats : null}
                  onValueChange={(value) => setSeats(value)}
                  min={1}
                  max={15}
                  aria-invalid={errors.carSeats ? true : undefined}
                  aria-describedby={errors.carSeats ? "carSeats-error" : undefined}
                />
              </div>
              <ChoicePill
                role="checkbox"
                checked={seats === 0}
                onClick={() => setSeats(seats === 0 ? null : 0)}
                title="I don't have a car of my own"
              />
            </div>
          )}
          {seats !== null && <input type="hidden" name="carSeats" value={seats} />}
        </>,
      )}

      {sections.map((section) =>
        step(
          `waiver-${section.id}`,
          "Read this and complete the waiver before the build day.",
          <p className="text-sm whitespace-pre-line">
            <LinkedText text={section.body} />
          </p>,
        ),
      )}
    </form>
  );
}

// A pill-shaped choice that fills in when picked, as a checkbox or one of a
// set of radio buttons.
function ChoicePill({
  role,
  checked,
  onClick,
  title,
  lines = [],
  describedBy,
}: {
  role: "checkbox" | "radio";
  checked: boolean;
  onClick: () => void;
  title: string;
  lines?: (string | null)[];
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      aria-describedby={describedBy}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 hover-gold rounded-full border px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary-foreground bg-primary-foreground text-primary" : "border-muted-foreground/40",
        )}
      >
        {checked && <CheckIcon className="size-4" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{title}</span>
        {lines.map(
          (line) =>
            line && (
              <span key={line} className={cn("text-sm", checked ? "opacity-85" : "text-muted-foreground")}>
                {line}
              </span>
            ),
        )}
      </span>
    </button>
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
          className="flex items-center gap-3 rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
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
