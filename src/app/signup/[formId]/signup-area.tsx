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
  countActiveSignups,
  getMySignup,
  type MySignup,
} from "@/lib/form-signups/queries";
import { formatPhone } from "@/lib/phone";
import type { FormPhase } from "@/lib/signup-forms/phase";
import { shiftLabel, shiftTime, type OfferedShift } from "@/lib/signup-forms/queries";
import { formatDay, fromDay } from "@/lib/time";
import { shirtLabel } from "@/lib/volunteers";
import { SignupFields, type BuildChoice, type DetailsDefaults } from "./signup-fields";
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

// Everything on a form's page below the build details, as a panel for each
// step: confirming an email, then the signed-in email, then the form (or
// the volunteer's signup, with Update and Cancel). While the form is open,
// anyone can sign up. After it closes, volunteers who signed up can still
// cancel until the day's first shift starts.
export async function SignupArea({ form, phase }: SignupAreaProps) {
  const canCancel = new Date() < cancelDeadline(form.day, form.shifts);
  if (phase !== "open" && !(phase === "closed" && canCancel)) return null;
  const open = phase === "open";

  const email = await getVerifiedEmail();
  if (!email) {
    return (
      <Panel
        title={open ? "Sign in with your email" : "Already signed up?"}
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
        />
      </Panel>
    );
  }

  const mine = await getMySignup(form.id, email);
  const active = mine?.signup && !mine.signup.cancelledAt ? mine.signup : null;

  const fields = (submitLabel: string, chosenIds: string[]) => (
    <SignupFields
      action={submitSignup.bind(null, form.id)}
      sections={form.sections}
      builds={form.shifts.map(toChoice)}
      defaults={mine ? toDefaults(mine.details) : null}
      chosenIds={chosenIds}
      editing={chosenIds.length > 0}
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
      <Panel title="Your signup">
        <p className="text-sm text-muted-foreground">
          {mine?.signup
            ? "Your signup for this day is cancelled."
            : `We don't have a signup for ${email} on this day.`}
        </p>
      </Panel>
    );
  } else {
    const capacity = form.shifts.reduce((sum, shift) => sum + shift.capacity, 0);
    const taken = await countActiveSignups(form.id);
    content =
      capacity === 0 ? (
        <Message>No builds are scheduled for this day right now, so there&apos;s nothing to sign up for yet.</Message>
      ) : taken >= capacity ? (
        <Message>This build day is full. Thanks for your interest! Check the home page for other days.</Message>
      ) : (
        <>
          {mine?.signup?.cancelledAt && (
            <p className="px-2 text-sm text-muted-foreground">
              You cancelled your signup for this day. You can sign up again below.
            </p>
          )}
          {fields("Sign up", [])}
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
}: {
  email: string;
  details: MySignup["details"];
  shifts: OfferedShift[];
  chosen: string[];
}) {
  // Only shifts still offered: a cancelled shift no longer counts.
  const chosenShifts = shifts.filter((shift) => chosen.includes(shift.id));
  const shirt = shirtLabel(details.tShirtSize);
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
      </dl>

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Builds you could work at</p>
        {chosenShifts.length === 0 ? (
          <p className="text-muted-foreground">
            None of the builds you chose are still scheduled. Update your
            signup to choose others.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chosenShifts.map((shift) => (
              <li key={shift.id}>{shiftLabel(shift)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function toChoice(shift: OfferedShift): BuildChoice {
  return {
    id: shift.id,
    buildName: shift.build.name,
    address: shift.build.address,
    time: shiftTime(shift),
    notes: shift.notes,
  };
}

function toDefaults(details: MySignup["details"]): DetailsDefaults {
  return { ...details, phone: formatPhone(details.phone) };
}
