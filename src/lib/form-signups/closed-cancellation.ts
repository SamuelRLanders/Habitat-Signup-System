import "server-only";
import { formatPhone } from "@/lib/phone";
import { cancellationEffects } from "@/lib/placement/cancellation";
import { planForRoster, travelOf } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { getSignupForm } from "@/lib/signup-forms/queries";
import { TRANSPORTATION_SHORT } from "@/lib/volunteers";
import { sendClosedFormCancellation } from "./emails";
import { getFormRoster } from "./rosters";

// Tells admins that a volunteer cancelled after the form closed (signupId
// is their just-cancelled signup), on a form that sends these emails
// (SignupForm.cancellationEmails). It goes to the responsible admin of the
// build they were going to (or, if they weren't placed, of each build they
// chose) and the owner, once each. It says what the cancellation changes
// for travel (the plan with them, as admins saw it until now, against the
// plan without them) and lists who's waiting for that build, in order.
// Nobody is added from the waitlist after the form closes, so admins check
// with them and add them on the Assignments tab. Only admins who can edit
// are emailed; only they can act on it.
export async function alertAdminsOfCancellation(formId: string, signupId: string) {
  const form = await getSignupForm(formId);
  if (!form || !form.cancellationEmails) return;

  const roster = await getFormRoster(form.id, form.day, form.shifts);
  const cancelled = roster.find((signup) => signup.id === signupId);
  if (!cancelled) return;
  const signedUp = roster.filter((signup) => !signup.cancelledAt && !signup.waitlistedAt);
  const custom = form.assignmentsSavedAt !== null;
  const before = planForRoster(
    form.shifts,
    roster.filter((signup) => (!signup.cancelledAt && !signup.waitlistedAt) || signup.id === signupId),
    form,
    custom,
  );
  const after = planForRoster(form.shifts, signedUp, form, custom);

  const buildId = before.placement.get(signupId);
  const build = form.shifts.find((shift) => shift.id === buildId);
  // The builds whose admins hear about it, and whose waitlists are listed.
  const buildIds = build ? [build.id] : cancelled.shiftIds;

  const shifts = await prisma.shift.findMany({
    where: { id: { in: buildIds } },
    select: { responsible: { select: { email: true, name: true, role: true } } },
  });
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, select: { email: true, name: true, role: true } });
  const accounts = [...shifts.map((shift) => shift.responsible), owner].filter(
    (account) => account && account.role !== "VIEWER",
  );
  const admins = new Map(
    accounts.map((account) => [
      account!.email.toLowerCase(),
      { to: account!.email, name: account!.name || account!.email },
    ]),
  );
  if (admins.size === 0) return;

  const { travel, carSeats } = travelOf(
    cancelled.transportation,
    cancelled.carSeats,
    cancelled.driver.status !== "none",
    form.askTransportation,
  );
  const how = !form.askTransportation
    ? ""
    : travel === "driver"
      ? ` They were driving, with room for ${carSeats - 1} ${carSeats - 1 === 1 ? "rider" : "riders"}.`
      : travel === "rider"
        ? " They needed a ride."
        : " They were getting there on their own.";
  const wasGoing = (build ? `They were going to ${build.name}.` : "They weren't placed at any build.") + how;

  // Who's waiting for those builds, in the order they joined.
  const waiting = roster
    .filter(
      (signup) =>
        !signup.cancelledAt && signup.waitlistedAt && signup.shiftIds.some((id) => buildIds.includes(id)),
    )
    .sort((a, b) => a.waitlistedAt!.getTime() - b.waitlistedAt!.getTime())
    .map((signup) =>
      [
        `${signup.firstName} ${signup.lastName}`,
        signup.email,
        formatPhone(signup.phone),
        form.askTransportation && signup.transportation && TRANSPORTATION_SHORT[signup.transportation].toLowerCase(),
      ]
        .filter(Boolean)
        .join(", "),
    );

  await sendClosedFormCancellation({
    admins: [...admins.values()],
    formId: form.id,
    formName: form.name,
    day: form.day,
    volunteer: { name: `${cancelled.firstName} ${cancelled.lastName}`, email: cancelled.email },
    wasGoing,
    effects: cancellationEffects({
      builds: form.shifts,
      volunteers: signedUp.map((signup) => ({ id: signup.id, name: `${signup.firstName} ${signup.lastName}` })),
      before,
      after,
      custom,
      askTransportation: form.askTransportation,
    }),
    custom,
    waitlist: {
      for: build ? build.name : "the builds they chose",
      people: waiting,
    },
  });
}
