import { CheckCircle2Icon, CheckIcon } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { EmailCodeForm } from "@/components/email-code-form";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  forgetVerifiedEmail,
  sendSignupCode,
  verifySignupCode,
} from "@/lib/email-verification/actions";
import { getVerifiedEmail } from "@/lib/email-verification/session";
import { cancelSignup, submitSignup } from "@/lib/form-signups/actions";
import {
  cancelDeadline,
  getAskedToGroupWith,
  getMySignup,
  type AskedToGroupWith,
  type MySignup,
} from "@/lib/form-signups/queries";
import { formatPhone } from "@/lib/phone";
import { loadPlacementDay } from "@/lib/placement/load";
import type { BuildRoom } from "@/lib/placement/room";
import { buildRoom } from "@/lib/placement/solver";
import { prisma } from "@/lib/prisma";
import type { FormPhase } from "@/lib/signup-forms/phase";
import { shiftLabel, shiftTime, type OfferedShift } from "@/lib/signup-forms/queries";
import { formatDay, fromDay } from "@/lib/time";
import { seatsLabel, shirtLabel, TRANSPORTATION_OPTIONS } from "@/lib/volunteers";
import type { Transportation } from "@/generated/prisma/enums";
import { SignupFields, type BuildChoice, type DetailsDefaults } from "./signup-fields";

type SignupAreaProps = {
  form: {
    id: string;
    day: string;
    shifts: OfferedShift[];
    sections: { id: string; title: string; body: string }[];
  };
  phase: FormPhase;
};

// Everything on a form's page below the build details, as a panel for each
// step: confirming an email, then the signed-in email, then the form (or
// the volunteer's signup, with Cancel). Signups can't be changed; to change
// one, volunteers cancel and sign up again. While the form is open, anyone
// can sign up. After it closes, volunteers who signed up can still cancel
// until the day's first shift starts.
export async function SignupArea({ form, phase }: SignupAreaProps) {
  const canCancel = new Date() < cancelDeadline(form.day, form.shifts);
  if (phase !== "open" && !(phase === "closed" && canCancel)) return null;
  const open = phase === "open";

  const email = await getVerifiedEmail();
  if (!email) {
    return (
      <Panel
        title={open ? "Sign in with your Purdue email" : "Already signed up?"}
        description={
          open
            ? "We'll send you a 6-digit code to confirm it's you. You don't need an account."
            : "Confirm your email address to see or cancel your signup. We'll send you a 6-digit code."
        }
      >
        <EmailCodeForm
          sendAction={sendSignupCode.bind(null, form.id)}
          verifyAction={verifySignupCode}
          verifyLabels={{ idle: "Continue", pending: "Checking…" }}
          restartHref={`/signup/${form.id}`}
          emailLabel="Purdue email"
          emailHint={
            open
              ? "Use your @purdue.edu email. It's how we match you to Purdue's records, such as its approved driver list."
              : "Use the @purdue.edu email you signed up with."
          }
        />
      </Panel>
    );
  }

  const mine = await getMySignup(form.id, email);
  const active = mine?.signup && !mine.signup.cancelledAt ? mine.signup : null;
  // On a day with more than one build, volunteers can ask to be placed with
  // friends (src/lib/placement). Who has already asked for them:
  const grouping = form.shifts.length > 1;
  const askedBy = grouping ? await getAskedToGroupWith(form.id, email) : [];

  let content;
  if (active) {
    content = (
      <Panel title="Your signup">
        <Summary
          email={email}
          details={mine!.details}
          shifts={form.shifts}
          chosen={active.shiftIds}
          transportation={active.transportation}
          carSeats={mine!.carSeats}
          groupEmails={grouping ? active.groupEmails : []}
          askedBy={askedBy}
        />
        {open && (
          <p className="text-sm text-muted-foreground">
            Need to change something? Cancel your signup, then sign up again
            with your new answers.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <ActionButton
            action={cancelSignup.bind(null, form.id)}
            label="Cancel my signup"
            variant="outline"
            size="default"
            confirm={{
              title: "Cancel your signup?",
              description: open
                ? `You'll be taken off the list for ${formatDay(form.day, "short")}. You can sign up again while the form is open, if there's still room.`
                : `You'll be taken off the list for ${formatDay(form.day, "short")}. The form has closed, so you won't be able to sign up again.`,
              confirmLabel: "Cancel signup",
            }}
          />
        </div>
      </Panel>
    );
  } else if (!open) {
    content = (
      <Panel title="Your signup">
        <p className="text-sm text-muted-foreground">
          {mine?.signup
            ? "Your signup for this day is cancelled."
            : `We don't have a signup for ${email} on this day.`}
        </p>
      </Panel>
    );
  } else {
    // Who each build has room for, given everyone already signed up.
    const rooms = buildRoom(await loadPlacementDay(prisma, form.id, form.shifts));
    const capacity = form.shifts.reduce((sum, shift) => sum + shift.capacity, 0);
    const full = [...rooms.values()].every((room) => room.driverMinSeats === null);
    content =
      capacity === 0 ? (
        <Message>No builds are scheduled for this day right now, so there&apos;s nothing to sign up for yet.</Message>
      ) : full ? (
        <Message>This build day is full. Thanks for your interest! Check the home page for other days.</Message>
      ) : (
        <>
          {mine?.signup?.cancelledAt && (
            <p className="px-2 text-sm text-muted-foreground">
              You cancelled your signup for this day. You can sign up again below.
            </p>
          )}
          <SignupFields
            action={submitSignup.bind(null, form.id)}
            sections={form.sections}
            builds={form.shifts.map((shift) => toChoice(shift, rooms.get(shift.id)!))}
            defaults={mine ? toDefaults(mine.details) : null}
            driver={mine?.driver ?? { status: "none" }}
            savedCarSeats={mine?.carSeats ?? null}
            grouping={grouping ? { askedBy: askedBy.map((asker) => asker.name) } : null}
          />
        </>
      );
  }

  return (
    <>
      <SignedIn email={email} />
      {content}
    </>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Panel>
      <p className="py-2 text-center text-muted-foreground">{children}</p>
    </Panel>
  );
}

// The email this browser confirmed, with a way to switch to another, such
// as on a shared computer. It's a finished step, so it's greyed like the
// form's finished steps.
function SignedIn({ email }: { email: string }) {
  return (
    <Panel className="bg-muted/40 ring-foreground/5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <CheckIcon className="size-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold">Signed in</span>
            <span className="text-muted-foreground">{email}</span>
          </span>
        </span>
        <form action={forgetVerifiedEmail}>
          <Button type="submit" variant="outline" size="sm">
            Not you? Use a different email
          </Button>
        </form>
      </div>
    </Panel>
  );
}

function Summary({
  email,
  details,
  shifts,
  chosen,
  transportation,
  carSeats,
  groupEmails,
  askedBy,
}: {
  email: string;
  details: MySignup["details"];
  shifts: OfferedShift[];
  chosen: string[];
  transportation: Transportation | null;
  carSeats: number | null;
  groupEmails: string[];
  askedBy: AskedToGroupWith;
}) {
  const getting = TRANSPORTATION_OPTIONS.find((option) => option.value === transportation)?.label;
  // Only shifts still offered: a cancelled shift no longer counts.
  const chosenShifts = shifts.filter((shift) => chosen.includes(shift.id));
  const shirt = shirtLabel(details.tShirtSize);
  // Friends who asked for them and they asked for too are listed once.
  const alsoAskedBy = askedBy.filter((asker) => !groupEmails.includes(asker.email));
  const birthday = fromDay(details.dateOfBirth).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div role="status" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2Icon className="size-6 text-primary" aria-hidden="true" />
          You&apos;re signed up
        </h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email {email} to let you know which build you&apos;re placed at.
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>
          {details.firstName} {details.lastName}
        </dd>
        <dt className="text-muted-foreground">Phone</dt>
        <dd>{formatPhone(details.phone)}</dd>
        <dt className="text-muted-foreground">Birthday</dt>
        <dd>{birthday}</dd>
        <dt className="text-muted-foreground">T-shirt</dt>
        <dd>{shirt}</dd>
        <dt className="text-muted-foreground">Driver&apos;s license</dt>
        <dd>{details.hasDriversLicense ? "Yes" : "No"}</dd>
        {getting && (
          <>
            <dt className="text-muted-foreground">Getting there</dt>
            <dd>
              {getting}
              {transportation === "CAN_DRIVE" && carSeats !== null && ` (${seatsLabel(carSeats).toLowerCase()})`}
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Builds you could work at</p>
        {chosenShifts.length === 0 ? (
          <p className="text-muted-foreground">
            None of the builds you chose are still scheduled. Cancel your
            signup and sign up again to choose others.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chosenShifts.map((shift) => (
              <li key={shift.id}>{shiftLabel(shift)}</li>
            ))}
          </ul>
        )}
      </div>

      {(groupEmails.length > 0 || alsoAskedBy.length > 0) && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">Friends to work with</p>
          <ul className="flex flex-col gap-1">
            {groupEmails.map((friend) => (
              <li key={friend}>{friend}</li>
            ))}
            {alsoAskedBy.map((asker) => (
              <li key={asker.email}>
                {asker.name} <span className="text-muted-foreground">(asked for you)</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            We&apos;ll try to place you together, but making sure everyone has a
            spot and a ride comes first.
          </p>
        </div>
      )}
    </div>
  );
}

function toChoice(shift: OfferedShift, room: BuildRoom): BuildChoice {
  return {
    id: shift.id,
    buildName: shift.build.name,
    address: shift.build.address,
    time: shiftTime(shift),
    notes: shift.notes,
    room,
  };
}

function toDefaults(details: MySignup["details"]): DetailsDefaults {
  return { ...details, phone: formatPhone(details.phone) };
}
