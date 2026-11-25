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
import { hasRoomFor, type BuildRoom } from "@/lib/placement/room";
import type { Travel } from "@/lib/placement/solver";
import { submitForm } from "@/lib/submit-form";
import { formatDay } from "@/lib/time";
import {
  DRIVER_APPROVAL_URL,
  isVolunteerEmail,
  MAX_CAR_SEATS,
  MAX_GROUP_REQUESTS,
  MIN_CAR_SEATS,
  PURDUE_EMAIL_DOMAIN,
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

// A build working that day, which volunteers can choose.
export type BuildChoice = {
  id: string;
  buildName: string;
  address: string;
  time: string; // "8:00 AM – 12:00 PM"
  description: string | null;
  lunch: string | null;
  // Who the build has room for, given everyone already signed up.
  room: BuildRoom;
};

// How each answer to "Getting to the site" counts when placing volunteers.
// Only drivers who are approved or waiting for approval are offered
// CAN_DRIVE, so it always means a driver.
const TRAVEL: Record<Transportation, Travel> = {
  NEEDS_RIDE: "rider",
  OWN_WAY: "ownWay",
  CAN_DRIVE: "driver",
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
  // Whether the form asks how they're getting there. If not, everyone is
  // getting there on their own, and drivers aren't asked for approval.
  askTransportation: boolean;
  // On a day with more than one build, volunteers can ask to be placed with
  // friends; askedBy are the names of those who already asked for them.
  // Null on a day with one build, or a form that doesn't ask.
  grouping: { askedBy: string[] } | null;
  // Whether volunteers can join the waitlist for builds that are full for
  // them.
  waitlist: boolean;
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
  ["groupEmails", "group"],
];

// The signup form, shown once the volunteer has signed in with their email,
// as steps: their information, driver approval (if they have a license),
// how they're getting there, their car (if they'll drive others), the
// builds they could work at, friends to be placed with (on a day with more
// than one build), then each waiver. A form can leave out the driving and
// transportation steps, and the friends step. How they're getting there
// comes before the builds because it decides which builds have room for
// them (src/lib/placement). On a form with a waitlist, full builds can be
// chosen too, to wait for, but not alongside builds with room. One step is
// open at a time; finished steps can
// be reopened, and a step unlocks once every step before it is done. Every
// step's fields stay in the one form, so the last step's button submits them
// all. The server checks everything again (src/lib/form-signups).
export function SignupFields({
  action,
  sections,
  builds,
  defaults,
  driver,
  savedCarSeats,
  askTransportation,
  grouping,
  waitlist,
}: SignupFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [license, setLicense] = useState(defaults?.hasDriversLicense ?? null);
  const [driverForm, setDriverForm] = useState<"done" | "not-done" | null>(null);
  const [transport, setTransport] = useState<Transportation | null>(null);
  // Cars need at least MIN_CAR_SEATS, so ask again about a smaller one
  // given before that rule.
  const [seats, setSeats] = useState(
    savedCarSeats !== null && savedCarSeats >= MIN_CAR_SEATS ? savedCarSeats : null,
  );
  const [editingSeats, setEditingSeats] = useState(seats === null);
  const [name, setName] = useState(defaults ? `${defaults.firstName} ${defaults.lastName}` : "");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  // Friends' emails, as typed. There's always at least one box.
  const [friends, setFriends] = useState([""]);
  // Who each build has room for (by its ID). The server sends new ones if
  // the builds they chose fill up before they submit.
  const [rooms, setRooms] = useState<Record<string, BuildRoom>>(() =>
    Object.fromEntries(builds.map((build) => [build.id, build.room])),
  );
  // With only one build that day there's nothing to choose: the builds step
  // is left out, and they sign up for it once it has room for them.
  const onlyBuild = builds.length === 1 ? builds[0] : null;

  // Only drivers who are approved or waiting for approval (counting a
  // "yes" just now) can offer to drive others.
  const canDrive = license === true && (driver.status !== "none" || driverForm === "done");
  // Ways of getting there that some build still has room for.
  const travelHasRoom: Record<Transportation, boolean> = {
    NEEDS_RIDE: builds.some((build) => rooms[build.id].rider),
    OWN_WAY: builds.some((build) => rooms[build.id].ownWay),
    CAN_DRIVE: canDrive && builds.some((build) => rooms[build.id].driverMinSeats !== null),
  };
  // With a waitlist, any way of getting there can be chosen: where it's
  // full, they can wait.
  const transportChoice =
    askTransportation && transport && (transport !== "CAN_DRIVE" || canDrive) && (waitlist || travelHasRoom[transport])
      ? transport
      : null;
  const travel = askTransportation ? transportChoice && TRAVEL[transportChoice] : "ownWay";
  // Whether a build has room for them, given how they're getting there.
  const hasRoom = (build: BuildChoice) =>
    travel !== null && hasRoomFor(rooms[build.id], travel, seats);
  // Whether a build is full for them but can be chosen to wait for.
  const canWait = (build: BuildChoice) => waitlist && travel !== null && !hasRoom(build);
  const isChosen = (build: BuildChoice) => onlyBuild !== null || chosen.has(build.id);
  const chosenWithRoom = builds.filter((build) => isChosen(build) && hasRoom(build));
  // The builds they'll wait for: only when they haven't chosen any with
  // room, since then they'd simply be signed up.
  const chosenToWait = chosenWithRoom.length > 0 ? [] : builds.filter((build) => isChosen(build) && canWait(build));
  const joining = chosenToWait.length > 0;
  // Why a way of getting there is full: every build is, or the spots left
  // are held for drivers (so riders have rides), or there aren't enough
  // drivers yet for more riders.
  const anyRoom = builds.some((build) => rooms[build.id].driverMinSeats !== null);
  const onlyDrivers = anyRoom && !travelHasRoom.NEEDS_RIDE && !travelHasRoom.OWN_WAY;
  const travelNote = (option: Transportation) =>
    travelHasRoom[option]
      ? null
      : onlyDrivers && option !== "CAN_DRIVE"
        ? ONLY_DRIVERS
        : anyRoom && option === "NEEDS_RIDE" && travelHasRoom.OWN_WAY
          ? ONLY_OWN_WAY
          : FULL;

  const steps = [
    { id: "info", title: "Your information" },
    ...(askTransportation && license ? [{ id: "driver", title: "Driver approval" }] : []),
    ...(askTransportation ? [{ id: "transport", title: "Getting to the site" }] : []),
    ...(transportChoice === "CAN_DRIVE" ? [{ id: "car", title: "Your car" }] : []),
    ...(onlyBuild ? [] : [{ id: "builds", title: "Builds you could work at" }]),
    ...(grouping ? [{ id: "group", title: "Friends to work with" }] : []),
    ...sections.map((section) => ({ id: `waiver-${section.id}`, title: section.title })),
  ];
  const lastId = steps[steps.length - 1].id;

  const [active, setActive] = useState("info");
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // A finished step stays finished, except that the builds step needs a
  // chosen build with room (or to wait for): changing how they're getting
  // there, or a build filling up, can take that away.
  const isDone = (id: string) =>
    done.has(id) && (id !== "builds" || chosenWithRoom.length > 0 || joining);
  // Problems found before submitting; after submitting, the server's.
  const [stepErrors, setStepErrors] = useState<Errors | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: SignupFormState, formData: FormData) => {
      let result = await action(prev, formData);
      if (result.rooms) setRooms(result.rooms);
      // Without a builds step, the build filling up is a problem with how
      // they're getting there (or, without that question, the whole day).
      if (onlyBuild && result.errors?.shifts) {
        const { shifts, ...rest } = result.errors;
        result = {
          ...result,
          errors: !result.rooms
            ? { ...rest, form: shifts }
            : askTransportation
              ? {
                  ...rest,
                  transportation:
                    "Sorry, the build just filled up for volunteers getting there that way. Choose another way if there is one, or check the home page for other days.",
                }
              : { ...rest, form: "Sorry, the build just filled up. Check the home page for other days." },
        };
      }
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
    } else if (active === "driver" && driver.status === "none" && !driverForm) {
      problems.driverForm = "Tell us whether you've filled out the driver approval form.";
    } else if (active === "transport" && !transportChoice) {
      problems.transportation = "Tell us how you're getting to the build site.";
    } else if (active === "car" && seats === null) {
      problems.carSeats = "Tell us how many seats your car has.";
    } else if (active === "car" && seats !== null && seats < MIN_CAR_SEATS) {
      problems.carSeats = `To drive others, your car needs at least ${MIN_CAR_SEATS} seats, counting yours.`;
    } else if (active === "car" && onlyBuild && !hasRoom(onlyBuild) && !waitlist) {
      problems.carSeats = `The build only has room for another car with at least ${rooms[onlyBuild.id].driverMinSeats} seats, counting yours. With a smaller car, choose another way of getting there.`;
    } else if (active === "builds" && chosenWithRoom.length === 0 && !joining) {
      problems.shifts = "Choose at least one build you could work at.";
    } else if (active === "group") {
      const typed = friends.map((friend) => friend.trim().toLowerCase()).filter(Boolean);
      if (typed.some((friend) => !/^[^\s@]+@[^\s@]+$/.test(friend))) {
        problems.groupEmails = `Enter a valid email, like name${PURDUE_EMAIL_DOMAIN}.`;
      } else if (!typed.every(isVolunteerEmail)) {
        problems.groupEmails = `Enter their ${PURDUE_EMAIL_DOMAIN} email.`;
      }
    }

    setStepErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setDone((current) => new Set(current).add(active));
    const index = steps.findIndex((step) => step.id === active);
    open(steps[index + 1].id);
  }

  // Choosing a build with room drops any chosen to wait for, and the other
  // way round: they can't be both signed up and waiting.
  function toggle(build: BuildChoice, checked: boolean) {
    setChosen((current) => {
      const updated = new Set(current);
      if (checked) {
        updated.delete(build.id);
        return updated;
      }
      const room = hasRoom(build);
      for (const other of builds) {
        if (updated.has(other.id) && hasRoom(other) !== room) updated.delete(other.id);
      }
      updated.add(build.id);
      return updated;
    });
  }

  const summaries: Record<string, string> = {
    info: name,
    builds: joining
      ? `Waitlist: ${chosenToWait.map((build) => build.buildName).join(", ")}`
      : chosenWithRoom.map((build) => build.buildName).join(", "),
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
    group: friends.filter((friend) => friend.trim()).join(", ") || "No one added",
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
    const unlocked = steps.slice(0, index).every((s) => isDone(s.id));
    return (
      <Step
        key={id}
        id={`step-${id}`}
        number={index + 1}
        title={steps[index].title}
        description={description}
        summary={summaries[id]}
        status={id === active ? "active" : unlocked && isDone(id) ? "done" : "locked"}
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
            <Button type="submit" size="lg" loading={pending} className="w-full sm:w-fit">
              {joining ? (pending ? "Joining…" : "Join the waitlist") : pending ? "Signing up…" : "Sign up"}
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
      {onlyBuild && (
        <section className="flex flex-col gap-1 rounded-3xl bg-muted/40 p-5 ring-1 ring-foreground/5 sm:p-6">
          <p className="text-sm text-muted-foreground">The build</p>
          <h2 className="text-lg font-semibold">{onlyBuild.buildName}</h2>
          <p className="text-sm">
            {onlyBuild.time} · {onlyBuild.address}
          </p>
          {onlyBuild.description && <p className="text-sm text-muted-foreground">{onlyBuild.description}</p>}
          {onlyBuild.lunch && <p className="text-sm text-muted-foreground">Lunch: {onlyBuild.lunch}</p>}
          {joining && (
            <>
              <p className="text-sm font-medium text-destructive">
                {waitNote(fullNote(rooms[onlyBuild.id], travel, askTransportation), true)}
              </p>
              <p className="mt-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm">{WAITLIST_NOTE}</p>
            </>
          )}
        </section>
      )}
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
            , please do. Put NA for any question you don&apos;t know how to answer.
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
              <p>Put NA for any question on the form you don&apos;t know how to answer.</p>
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
          {/* With a waitlist every way can be chosen, and the builds (or
              the one build) say which are full, so there's nothing to warn
              about here. */}
          {!waitlist && anyRoom && !(travelHasRoom.NEEDS_RIDE && travelHasRoom.OWN_WAY) && (
            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              {onlyDrivers
                ? `The spots left ${onlyBuild ? "are" : "at every build are"} held for volunteers who can drive others, so everyone who needs a ride has one.${canDrive ? "" : " Check back later, or see the home page for other days."}`
                : "Volunteers who need a ride can only be placed where a driver has room for them. As more drivers sign up, more riders can too."}
            </p>
          )}
          <div role="radiogroup" aria-label="Getting to the site" className="flex flex-col gap-2">
            {TRANSPORTATION_OPTIONS.filter((option) => option.value !== "CAN_DRIVE" || canDrive).map(
              (option) => (
                <ChoicePill
                  key={option.value}
                  role="radio"
                  checked={transportChoice === option.value}
                  onClick={() => setTransport(option.value)}
                  title={option.label}
                  // Full when no build has room for one more volunteer
                  // getting there this way. With a waitlist they can still
                  // choose it, and the builds say what's full.
                  disabled={!waitlist && !travelHasRoom[option.value]}
                  note={waitlist ? null : travelNote(option.value)}
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
              <p>You&apos;re registered with a car with {seats} seats.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingSeats(true)}>
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="carSeats">How many seats does your car have, counting yours?</Label>
              <p className="text-sm text-muted-foreground">
                At least {MIN_CAR_SEATS}, so you can drive at least {MIN_CAR_SEATS - 1} other
                volunteers.
              </p>
              <NumberField
                id="carSeats"
                value={seats}
                onValueChange={(value) => setSeats(value)}
                min={MIN_CAR_SEATS}
                max={MAX_CAR_SEATS}
                aria-invalid={errors.carSeats ? true : undefined}
                aria-describedby={errors.carSeats ? "carSeats-error" : undefined}
              />
            </div>
          )}
          {seats !== null && <input type="hidden" name="carSeats" value={seats} />}
        </>,
      )}

      {step(
        "builds",
        "Choose every build you'd be able to work at. We'll place you at one of them and let you know.",
        <>
          {error("shifts")}
          {builds.some(canWait) && (
            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              {WAITLIST_NOTE}
              {builds.some(hasRoom) && " You can choose builds with room or join waitlists, but not both."}
            </p>
          )}
          <div role="group" aria-label="Builds" className="flex flex-col gap-2">
            {builds.map((build) => {
              const full = !hasRoom(build);
              const checked = chosenWithRoom.includes(build) || chosenToWait.includes(build);
              return (
                <ChoicePill
                  key={build.id}
                  role="checkbox"
                  checked={checked}
                  onClick={() => toggle(build, checked)}
                  describedBy={errors.shifts ? "shifts-error" : undefined}
                  title={build.buildName}
                  disabled={full && !canWait(build)}
                  note={
                    full
                      ? waitNote(fullNote(rooms[build.id], travel, askTransportation), canWait(build))
                      : null
                  }
                  lines={[
                    `${build.time} · ${build.address}`,
                    build.description,
                    build.lunch && `Lunch: ${build.lunch}`,
                  ]}
                />
              );
            })}
          </div>
        </>,
      )}
      {chosenWithRoom.map((build) => (
        <input key={build.id} type="hidden" name="shiftId" value={build.id} />
      ))}
      {chosenToWait.map((build) => (
        <input key={build.id} type="hidden" name="waitlistShiftId" value={build.id} />
      ))}

      {grouping &&
        step(
          "group",
          askTransportation
            ? "Want to work with friends? Add their Purdue emails and we'll try to place you at the same build, and in the same car if you're riding together."
            : "Want to work with friends? Add their Purdue emails and we'll try to place you at the same build.",
          <>
            {grouping.askedBy.length > 0 && (
              <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                {listNames(grouping.askedBy)} already asked to be placed with you, so you
                don&apos;t need to add {grouping.askedBy.length === 1 ? "them" : "anyone"} back.
              </p>
            )}
            {error("groupEmails")}
            <div className="flex flex-col gap-2">
              {friends.map((friend, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    name="groupEmail"
                    // Not type="email": the browser would quietly refuse to
                    // submit a bad one from a closed step. We check it instead.
                    inputMode="email"
                    value={friend}
                    onChange={(event) =>
                      setFriends((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                    }
                    placeholder={`name${PURDUE_EMAIL_DOMAIN}`}
                    autoComplete="off"
                    aria-label={`Friend ${index + 1}'s Purdue email`}
                    aria-invalid={errors.groupEmails ? true : undefined}
                    aria-describedby={errors.groupEmails ? "groupEmails-error" : undefined}
                  />
                  {(friends.length > 1 || friend) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFriends((current) =>
                          current.length > 1 ? current.filter((_, i) => i !== index) : [""],
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {friends.length < MAX_GROUP_REQUESTS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setFriends((current) => [...current, ""])}
              >
                Add another friend
              </Button>
            )}
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

// "Bob", "Bob and Alice", or "Bob, Alice and Carol".
function listNames(names: string[]) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// The short phrases saying why a build, or a way of getting there, can't be
// chosen. Spots can be held for drivers, so a build can be full for some
// volunteers and not others (src/lib/placement/solver.ts).
const FULL = "Slots are full";

// Shown wherever volunteers can join a waitlist.
const WAITLIST_NOTE =
  "If you join the waitlist for any build(s), you won't be placed immediately, but if someone cancels you will be added automatically and contacted.";

// A full option's note, offering the waitlist when it can be waited for:
// "Slots are full, but you can join the waitlist", or "Only accepting people
// willing to drive others, or join the waitlist", so it's clear they can
// either change how they're getting there or wait.
function waitNote(note: string | null, canWait: boolean) {
  if (!note || !canWait) return note;
  return note === FULL ? `${FULL}, but you can join the waitlist` : `${note}, or join the waitlist`;
}
const ONLY_DRIVERS = "Only accepting people willing to drive others";
const ONLY_OWN_WAY = "Only accepting people who can find their own transportation";

// Why a build the volunteer can't choose is closed to them, given how
// they're getting there.
function fullNote(room: BuildRoom, travel: Travel | null, askTransportation: boolean) {
  if (!askTransportation || room.driverMinSeats === null) return FULL;
  if (travel === "driver") return `Only accepting cars with ${room.driverMinSeats} or more seats`;
  if (!room.rider && !room.ownWay) return ONLY_DRIVERS;
  if (travel === "rider" && room.ownWay) return ONLY_OWN_WAY;
  return FULL;
}

// A pill-shaped choice that fills in when picked, as a checkbox or one of a
// set of radio buttons. A disabled one is greyed out, except for its note
// (why it can't be chosen, or that it's a waitlist), which is red under the
// title so it stands out.
function ChoicePill({
  role,
  checked,
  onClick,
  title,
  note = null,
  lines = [],
  describedBy,
  disabled = false,
}: {
  role: "checkbox" | "radio";
  checked: boolean;
  onClick: () => void;
  title: string;
  note?: string | null;
  lines?: (string | null)[];
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      aria-describedby={describedBy}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-full border px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        disabled
          ? "cursor-not-allowed border-border"
          : checked
            ? "hover-gold border-primary bg-primary text-primary-foreground"
            : "hover-gold border-border hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary-foreground bg-primary-foreground text-primary" : "border-muted-foreground/40",
          disabled && "opacity-60",
        )}
      >
        {checked && <CheckIcon className="size-4" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-medium", disabled && "opacity-60")}>{title}</span>
        {note && (
          <span className={cn("text-sm font-medium", checked ? "opacity-85" : "text-destructive")}>{note}</span>
        )}
        {lines.map(
          (line) =>
            line && (
              <span
                key={line}
                className={cn("text-sm", checked ? "opacity-85" : "text-muted-foreground", disabled && "opacity-60")}
              >
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
