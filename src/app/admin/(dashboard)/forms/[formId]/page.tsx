import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FormStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import { emailsSentToday } from "@/lib/email";
import { emailLimitNote } from "@/lib/email-limit";
import { getFormRoster, type RosterSignup } from "@/lib/form-signups/rosters";
import { planForRoster, requestedPairs, travelRosterFor } from "@/lib/placement/load";
import { placedAt, type BuildPlan, type Placement } from "@/lib/placement/solver";
import { prisma } from "@/lib/prisma";
import {
  cancelSignupForm,
  deleteSignupForm,
  setSignupFormStatus,
} from "@/lib/signup-forms/actions";
import { formPhase } from "@/lib/signup-forms/phase";
import { getSignupForm, shiftTime, today, totalSpots } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDate, formatDay, toDay } from "@/lib/time";
import { T_SHIRT_SIZES } from "@/lib/volunteers";
import { BackLink, SpotsMeter } from "../../admin-parts";
import { VolunteerTable } from "../../volunteer-table";
import { PhaseBadge, phaseNote } from "../form-parts";
import { ShareDialog } from "../share-dialog";
import { TravelRosterDialog } from "../travel-roster-dialog";
import { VolunteersDialog } from "../volunteers-dialog";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: { date: true },
  });
  return { title: form ? `Form for ${formatDay(toDay(form.date), "short")}` : "Signup form" };
}

export default async function SignupFormPage({
  params,
}: PageProps<"/admin/forms/[formId]">) {
  await requireAdmin();
  const { formId } = await params;

  const form = await getSignupForm(formId);
  if (!form) notFound();

  const phase = formPhase(form);
  // An event can be cancelled until its day is over. Drafts nobody signed
  // up for are deleted instead.
  const canCancel =
    form.status !== "CANCELLED" &&
    form.day >= today() &&
    (form.status === "PUBLISHED" || form.signupCount > 0);
  const sentToday = canCancel ? await emailsSentToday() : 0;
  const spots = totalSpots(form.shifts);
  const roster = await getFormRoster(form.id, form.shifts);
  const active = roster.filter((signup) => !signup.cancelledAt);
  const cancelled = roster.filter((signup) => signup.cancelledAt);
  // A likely placement of everyone signed up (src/lib/placement).
  const plan = planForRoster(form.shifts, active);
  // Purdue's travel roster, following that placement, and what to check
  // before sending it.
  const travel = travelRosterFor(form.day, form.shifts, active, plan.placement);
  const pendingDrivers = [...plan.pendingDrivers.values()].reduce((sum, n) => sum + n, 0);
  const rosterWarnings = [
    plan.leftOut.length > 0 &&
      `Not on the roster because they can't be placed right now: ${names(plan.leftOut)}.`,
    travel.withoutRide > 0 &&
      `${plural(travel.withoutRide, "rider doesn't", "riders don't")} have a driver yet (marked "No ride yet").`,
    pendingDrivers > 0 &&
      `${plural(pendingDrivers, "driver is", "drivers are")} still waiting for Purdue approval (marked "approval pending").`,
  ].filter((warning) => typeof warning === "string");
  // Builds on a form have different names, so a name is enough.
  const labels = new Map(form.shifts.map((shift) => [shift.id, shift.name]));
  // How many active signups chose each shift.
  const willing = new Map<string, number>();
  for (const signup of active) {
    for (const id of signup.shiftIds) willing.set(id, (willing.get(id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/admin/forms">Back to forms</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{formatDay(form.day)}</h1>
              <PhaseBadge phase={phase} />
            </div>
            <p className="text-sm text-muted-foreground">{phaseNote(phase, form)}</p>
            <p className="text-sm">
              {form.signupCount} {form.signupCount === 1 ? "volunteer has" : "volunteers have"} signed up
              {spots > 0 && ` of ${spots} ${spots === 1 ? "spot" : "spots"}`}.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {form.status === "PUBLISHED" && <ShareDialog path={`/signup/${form.id}`} />}
            <VolunteersDialog count={active.length}>
              <Volunteers
                formId={form.id}
                day={form.day}
                active={active}
                cancelled={cancelled}
                labels={labels}
                placement={plan.placement}
              />
            </VolunteersDialog>
            {active.length > 0 && <TravelRosterDialog text={travel.text} warnings={rosterWarnings} />}
            {form.status !== "CANCELLED" && (
              <Link
                href={`/admin/forms/${form.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit form
              </Link>
            )}
            <StatusActions
              formId={form.id}
              status={form.status}
              signupCount={form.signupCount}
            />
            {canCancel && (
              <CancelEventButton formId={form.id} signupCount={form.signupCount} sentToday={sentToday} />
            )}
          </div>
        </div>

        {form.description && <p className="whitespace-pre-line">{form.description}</p>}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="sites-heading">
        <div>
          <h2 id="sites-heading" className="text-lg font-semibold">
            Builds
          </h2>
          <p className="text-sm text-muted-foreground">
            Volunteers say which builds they could work at. Each build shows a
            likely placement; it isn&apos;t final.
          </p>
        </div>

        {form.shifts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No builds yet.{" "}
              <Link href={`/admin/forms/${form.id}/edit`} className="underline underline-offset-4">
                Edit the form
              </Link>{" "}
              to add the day&apos;s builds.
            </CardContent>
          </Card>
        ) : (
          form.shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 hover-gold rounded-xl p-4 ring-1 ring-foreground/10"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="font-semibold">{shift.name}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{shiftTime(shift)}</span> ·{" "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shift.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {shift.address}
                  </a>
                </p>
                {shift.description && (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {shift.description}
                  </p>
                )}
                <ShiftPlan
                  build={plan.builds.get(shift.id)!}
                  pendingDrivers={plan.pendingDrivers.get(shift.id) ?? 0}
                />
              </div>
              <SpotsMeter willing={willing.get(shift.id) ?? 0} capacity={shift.capacity} />
            </div>
          ))
        )}

        {form.cancelledShifts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Cancelled, so not offered: {form.cancelledShifts.map((shift) => shift.name).join(", ")}.
            Volunteers who chose them are kept, and count again if you restore
            one from Edit form.
          </p>
        )}
      </section>
    </div>
  );
}

// "T-shirts: S 2 · M 5 · L 3" and "3 need a ride · 2 can drive (1 approved,
// 1 pending), 9 seats", for ordering shirts and planning rides. A driver
// declined or revoked after signing up counts as no longer approved.
function Totals({ signups, placement }: { signups: RosterSignup[]; placement: Placement }) {
  const count = (test: (signup: RosterSignup) => boolean) => signups.filter(test).length;
  const sizes = T_SHIRT_SIZES.flatMap((size) => {
    const n = count((signup) => signup.tShirtSize === size.value);
    return n > 0 ? [`${size.label} ${n}`] : [];
  });
  const drivers = signups.filter((signup) => signup.transportation === "CAN_DRIVE");
  const approved = drivers.filter((signup) => signup.driver.status === "approved").length;
  const pending = drivers.filter((signup) => signup.driver.status === "pending").length;
  const seats = drivers.reduce((sum, signup) => sum + (signup.carSeats ?? 0), 0);
  const pairs = requestedPairs(signups);
  const together = pairs.filter(([a, b]) => placement.has(a) && placement.get(a) === placement.get(b));
  return (
    <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
      <p>T-shirts: {sizes.join(" · ")}</p>
      <p>
        {count((s) => s.transportation === "NEEDS_RIDE")} need a ride ·{" "}
        {drivers.length} can drive ({approved} approved, {pending} pending
        {drivers.length - approved - pending > 0 &&
          `, ${drivers.length - approved - pending} no longer approved`}
        ),{" "}
        {seats} {seats === 1 ? "seat" : "seats"} · {count((s) => s.transportation === "OWN_WAY")} getting
        there on their own
      </p>
      {pairs.length > 0 && (
        <p>
          Friends: {together.length} of {plural(pairs.length, "pair", "pairs")} together in the likely
          placement
        </p>
      )}
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const name = (signup: RosterSignup) => `${signup.firstName} ${signup.lastName}`;
const names = (signups: RosterSignup[]) => signups.map(name).join(", ");

// Each volunteer's friends (by signup ID): who they asked to be placed
// with, and who asked for them, noting whether the likely placement keeps
// them together. One request is enough, so a friend is listed on both.
function friendsOf(active: RosterSignup[], placement: Placement) {
  const byEmail = new Map(active.map((signup) => [signup.email, signup]));
  const friends = new Map(active.map((signup) => [signup.id, [] as { label: string; note: string }[]]));
  const link = (signup: RosterSignup, other: RosterSignup) => {
    const list = friends.get(signup.id)!;
    if (list.some((friend) => friend.label === name(other))) return;
    const where = placement.get(signup.id);
    list.push({ label: name(other), note: where && where === placement.get(other.id) ? "together" : "apart" });
  };
  for (const signup of active) {
    for (const email of signup.groupEmails) {
      const other = byEmail.get(email);
      if (!other) friends.get(signup.id)!.push({ label: email, note: "not signed up" });
      else if (other.id !== signup.id) {
        link(signup, other);
        link(other, signup);
      }
    }
  }
  return friends;
}

// What the "Volunteers" popup shows: totals, the CSV download, the table,
// and anyone who cancelled.
function Volunteers({
  formId,
  day,
  active,
  cancelled,
  labels,
  placement,
}: {
  formId: string;
  day: string;
  active: RosterSignup[];
  cancelled: RosterSignup[];
  labels: Map<string, string>;
  // The likely placement, to say whether friends are together.
  placement: Placement;
}) {
  const friends = friendsOf(active, placement);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {(active.length > 0 || cancelled.length > 0) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {active.length > 0 ? <Totals signups={active} placement={placement} /> : <span />}
          {/* A plain link, not <Link>: it downloads a file. */}
          <a
            href={`/admin/forms/${formId}/export`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon aria-hidden="true" />
            Download CSV
          </a>
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Nobody has signed up yet.
          </CardContent>
        </Card>
      ) : (
        <VolunteerTable
          day={day}
          shiftsHeading="Could work"
          brief
          scrollable
          rows={active.map((signup) => ({
            ...signup,
            shifts: signup.shiftIds.flatMap((id) => labels.get(id) ?? []),
            friends: friends.get(signup.id),
          }))}
        />
      )}

      {cancelled.length > 0 && (
        <details className="rounded-xl p-4 text-sm ring-1 ring-foreground/10">
          <summary className="cursor-pointer font-medium">
            Cancelled signups ({cancelled.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-1">
            {cancelled.map((signup) => (
              <li key={signup.id}>
                {signup.firstName} {signup.lastName} ·{" "}
                <a href={`mailto:${signup.email}`} className="hover:underline">
                  {signup.email}
                </a>{" "}
                <span className="text-muted-foreground">
                  · cancelled {formatDate(signup.cancelledAt!, DEFAULT_TIME_ZONE)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// "Likely here: 4 need a ride · 1 driver, 4 seats for riders · 2 on their
// own · 1 spot held for a driver"
function ShiftPlan({ build, pendingDrivers }: { build: BuildPlan; pendingDrivers: number }) {
  if (placedAt(build) === 0) {
    return <p className="text-sm text-muted-foreground">Nobody placed here yet.</p>;
  }
  const parts = [
    build.riders > 0 && `${build.riders} need${build.riders === 1 ? "s" : ""} a ride`,
    build.drivers > 0 &&
      `${plural(build.drivers, "driver", "drivers")}${pendingDrivers > 0 ? ` (${pendingDrivers} pending)` : ""}, ${plural(build.passengerSeats, "seat", "seats")} for riders`,
    build.ownWay > 0 && `${build.ownWay} on their own`,
  ].filter(Boolean);

  return (
    <p className="text-sm text-muted-foreground">
      <span className="text-foreground">Likely here:</span> {parts.join(" · ")}
      {build.heldDriverSpots > 0 && (
        <span className="font-medium text-foreground">
          {" "}
          · {plural(build.heldDriverSpots, "spot", "spots")} held for{" "}
          {build.heldDriverSpots === 1 ? "a driver" : "drivers"}
        </span>
      )}
    </p>
  );
}

// Cancelling emails everyone signed up, so the admin is told that first.
function CancelEventButton({
  formId,
  signupCount,
  sentToday,
}: {
  formId: string;
  signupCount: number;
  sentToday: number;
}) {
  return (
    <ActionButton
      action={cancelSignupForm.bind(null, formId)}
      label="Cancel event"
      variant="ghost"
      confirm={{
        title: "Cancel this event?",
        description:
          "The form will say the event is cancelled, and nobody will be able to sign up. This can't be undone.",
        confirmLabel: signupCount > 0 ? "Cancel event and email" : "Cancel event",
        email:
          signupCount > 0
            ? {
                message: `This emails ${plural(signupCount, "volunteer", "volunteers")} signed up to tell them the event is cancelled.`,
                limitNote: emailLimitNote(sentToday, signupCount),
              }
            : { message: "Nobody is signed up, so no emails will be sent." },
      }}
    />
  );
}

// Drafts can be published or deleted; published forms can be unpublished.
// A cancelled event's form stays as it is.
function StatusActions({
  formId,
  status,
  signupCount,
}: {
  formId: string;
  status: FormStatus;
  signupCount: number;
}) {
  const setStatus = (next: "DRAFT" | "PUBLISHED") => setSignupFormStatus.bind(null, formId, next);

  if (status === "CANCELLED") return null;
  if (status === "PUBLISHED") {
    return (
      <ActionButton
        action={setStatus("DRAFT")}
        label="Unpublish"
        confirm={
          signupCount > 0
            ? {
                title: "Unpublish this form?",
                description:
                  "Volunteers have signed up. Their signups are kept, but they won't be able to see or cancel them until the form is published again.",
                confirmLabel: "Unpublish",
              }
            : undefined
        }
      />
    );
  }
  return (
    <>
      <ActionButton
        action={deleteSignupForm.bind(null, formId)}
        label="Delete"
        variant="ghost"
        confirm={{
          title: "Delete this form?",
          description: "The form, its builds and its sections will be permanently deleted.",
          confirmLabel: "Delete form",
        }}
      />
      <ActionButton action={setStatus("PUBLISHED")} label="Publish" variant="default" />
    </>
  );
}
