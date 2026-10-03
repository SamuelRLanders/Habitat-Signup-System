import { CheckCircle2Icon } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { EmailCodeForm } from "@/components/email-code-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  forgetVerifiedEmail,
  sendSignupCode,
  verifySignupCode,
} from "@/lib/email-verification/actions";
import { getVerifiedEmail } from "@/lib/email-verification/session";
import { cancelSignup, submitSignup } from "@/lib/form-signups/actions";
import {
  cancelDeadline,
  countActiveSignups,
  getMySignup,
  type MySignup,
} from "@/lib/form-signups/queries";
import { formatPhone } from "@/lib/phone";
import type { FormPhase } from "@/lib/signup-forms/phase";
import type { OfferedShift } from "@/lib/signup-forms/queries";
import {
  DEFAULT_TIME_ZONE,
  formatDay,
  formatTimeRange,
  fromDay,
  timeZoneLabel,
} from "@/lib/time";
import { T_SHIRT_SIZES } from "@/lib/volunteers";
import { SignupFields, type DetailsDefaults, type ShiftChoice } from "./signup-fields";
import { SignupPanel } from "./signup-panel";

type SignupAreaProps = {
  form: {
    id: string;
    day: string;
    shifts: OfferedShift[];
    sections: { id: string; title: string; body: string }[];
  };
  phase: FormPhase;
};

// The bottom of a form's page, where volunteers confirm their email and
// then sign up, or see, update or cancel their signup. While the form is
// open, anyone can sign up. After it closes, volunteers who signed up can
// still cancel until the day's first shift starts.
export async function SignupArea({ form, phase }: SignupAreaProps) {
  const canCancel = new Date() < cancelDeadline(form.day, form.shifts);
  if (phase !== "open" && !(phase === "closed" && canCancel)) return null;
  const open = phase === "open";

  const email = await getVerifiedEmail();
  if (!email) {
    return (
      <Area title={open ? "Sign up" : "Already signed up?"}>
        <div className="flex flex-col gap-4 rounded-xl p-5 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            {open
              ? "First, confirm your email address. We'll send you a 6-digit code. You don't need an account."
              : "Confirm your email address to see or cancel your signup. We'll send you a 6-digit code."}
          </p>
          <EmailCodeForm
            sendAction={sendSignupCode.bind(null, form.id)}
            verifyAction={verifySignupCode}
            verifyLabels={{ idle: "Continue", pending: "Checking…" }}
            restartHref={`/signup/${form.id}`}
          />
        </div>
      </Area>
    );
  }

  const mine = await getMySignup(form.id, email);
  const active = mine?.signup && !mine.signup.cancelledAt ? mine.signup : null;

  const fields = (submitLabel: string, chosenShiftIds: string[]) => (
    <SignupFields
      action={submitSignup.bind(null, form.id)}
      sections={form.sections}
      shifts={form.shifts.map(toChoice)}
      defaults={mine ? toDefaults(mine.details) : null}
      chosenShiftIds={chosenShiftIds}
      submitLabel={submitLabel}
    />
  );

  let content;
  if (active) {
    content = (
      <SignupPanel
        key={active.updatedAt.getTime()}
        summary={
          <Summary email={email} details={mine!.details} shifts={form.shifts} chosen={active.shiftIds} />
        }
        editForm={open ? fields("Save changes", active.shiftIds) : null}
        cancelButton={
          <ActionButton
            action={cancelSignup.bind(null, form.id)}
            label="Cancel my signup"
            variant="ghost"
            size="default"
            confirm={{
              title: "Cancel your signup?",
              description: open
                ? `You'll be taken off the list for ${formatDay(form.day, "short")}. You can sign up again while the form is open.`
                : `You'll be taken off the list for ${formatDay(form.day, "short")}. The form has closed, so you won't be able to sign up again.`,
              confirmLabel: "Cancel signup",
            }}
          />
        }
      />
    );
  } else if (!open) {
    content = (
      <p className="text-sm text-muted-foreground">
        {mine?.signup
          ? "Your signup for this day is cancelled."
          : `We don't have a signup for ${email} on this day.`}
      </p>
    );
  } else {
    const capacity = form.shifts.reduce((sum, shift) => sum + shift.capacity, 0);
    const taken = await countActiveSignups(form.id);
    content =
      capacity === 0 ? (
        <Message>No shifts are scheduled for this day right now, so there&apos;s nothing to sign up for yet.</Message>
      ) : taken >= capacity ? (
        <Message>This build day is full. Thanks for your interest! Check the home page for other days.</Message>
      ) : (
        <div className="flex flex-col gap-6">
          {mine?.signup?.cancelledAt && (
            <p className="text-sm text-muted-foreground">
              You cancelled your signup for this day. You can sign up again below.
            </p>
          )}
          {fields("Sign up", [])}
        </div>
      );
  }

  return (
    <Area title={open && !active ? "Sign up" : "Your signup"}>
      <VerifiedEmail email={email} />
      {content}
    </Area>
  );
}

function Area({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="signup-heading">
      <h2 id="signup-heading" className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-6 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

// The email this browser confirmed, with a way to switch to another, such
// as on a shared computer.
function VerifiedEmail({ email }: { email: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
      <span>
        Confirmed email: <strong>{email}</strong>
      </span>
      <form action={forgetVerifiedEmail}>
        <Button type="submit" variant="outline" size="sm">
          Not you? Use a different email
        </Button>
      </form>
    </div>
  );
}

function Summary({
  email,
  details,
  shifts,
  chosen,
}: {
  email: string;
  details: MySignup["details"];
  shifts: OfferedShift[];
  chosen: string[];
}) {
  // Only shifts still offered: a cancelled shift no longer counts.
  const chosenShifts = shifts.filter((shift) => chosen.includes(shift.id));
  const shirt = T_SHIRT_SIZES.find((size) => size.value === details.tShirtSize)?.label;
  const birthday = fromDay(details.dateOfBirth).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div role="status" className="flex flex-col gap-5 rounded-xl bg-muted/50 p-5 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2Icon className="size-6 text-primary" aria-hidden="true" />
          You&apos;re signed up
        </h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email {email} to let you know which shift you&apos;re placed on.
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
      </dl>

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Shifts you could work</p>
        {chosenShifts.length === 0 ? (
          <p className="text-muted-foreground">
            None of the shifts you chose are still scheduled. Update your
            signup to choose others.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chosenShifts.map((shift) => (
              <li key={shift.id}>
                {shift.build.name}, {shiftTime(shift)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function shiftTime(shift: OfferedShift) {
  const zone = shift.build.timeZone;
  const time = formatTimeRange(shift.startsAt, shift.endsAt, zone);
  return zone === DEFAULT_TIME_ZONE ? time : `${time} (${timeZoneLabel(zone)} time)`;
}

function toChoice(shift: OfferedShift): ShiftChoice {
  return {
    id: shift.id,
    buildId: shift.build.id,
    buildName: shift.build.name,
    time: shiftTime(shift),
    notes: shift.notes,
  };
}

function toDefaults(details: MySignup["details"]): DetailsDefaults {
  return { ...details, phone: formatPhone(details.phone) };
}
