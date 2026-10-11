import "server-only";
import { OPERATIONS_LEAD } from "@/lib/email";
import { cancellationEffects } from "@/lib/placement/cancellation";
import { planForRoster, travelOf } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { getSignupForm } from "@/lib/signup-forms/queries";
import { sendClosedFormCancellation } from "./emails";
import { getFormRoster } from "./rosters";

// Tells the admin who created a form and the operations lead that a
// volunteer cancelled after it closed (signupId is their just-cancelled
// signup), with what it changes for travel: the plan with them, as admins
// saw it until now, against the plan without them. Nobody new can sign up
// to fill the gap, so admins may need to sort out rides or resend the
// travel roster. Only admins with an account are emailed, once each (the
// creator may be the operations lead); only they see the roster here.
export async function alertAdminsOfCancellation(formId: string, signupId: string) {
  const form = await getSignupForm(formId);
  if (!form) return;
  const accounts = await prisma.user.findMany({
    where: {
      OR: [
        ...(form.createdById ? [{ id: form.createdById }] : []),
        { email: { equals: OPERATIONS_LEAD, mode: "insensitive" as const } },
      ],
    },
    select: { email: true, name: true },
  });
  const admins = new Map(
    accounts.map((account) => [
      account.email.toLowerCase(),
      { to: account.email, name: account.name || account.email },
    ]),
  );
  if (admins.size === 0) return;

  const roster = await getFormRoster(form.id, form.day, form.shifts);
  const cancelled = roster.find((signup) => signup.id === signupId);
  if (!cancelled) return;
  const active = roster.filter((signup) => !signup.cancelledAt);
  const custom = form.assignmentsSavedAt !== null;
  const before = planForRoster(
    form.shifts,
    roster.filter((signup) => !signup.cancelledAt || signup.id === signupId),
    form,
    custom,
  );
  const after = planForRoster(form.shifts, active, form, custom);

  const buildId = before.placement.get(signupId);
  const build = form.shifts.find((shift) => shift.id === buildId);
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

  await sendClosedFormCancellation({
    admins: [...admins.values()],
    formId: form.id,
    formName: form.name,
    day: form.day,
    volunteer: { name: `${cancelled.firstName} ${cancelled.lastName}`, email: cancelled.email },
    wasGoing,
    effects: cancellationEffects({
      builds: form.shifts,
      volunteers: active.map((signup) => ({ id: signup.id, name: `${signup.firstName} ${signup.lastName}` })),
      before,
      after,
      custom,
      askTransportation: form.askTransportation,
    }),
    custom,
  });
}
