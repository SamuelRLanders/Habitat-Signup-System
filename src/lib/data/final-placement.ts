import "server-only";
import { cache } from "react";
import { cancelDeadline } from "@/lib/form-signups/queries";
import { getFormRoster } from "@/lib/form-signups/rosters";
import { planForRoster } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { getSignupForm, today } from "@/lib/signup-forms/queries";
import { fromDay, toDay } from "@/lib/time";

// Saves the planned assignments of each event whose form has closed and
// whose day's first build has started (SignupForm.placementSavedAt), when
// volunteers can no longer cancel. From then on the Assignments tab shows
// the confirmed assignments: where everyone went, which admins correct for
// the Data page, starting from this copy. Until it's saved, a form without
// custom assignments is placed afresh each time, from details (such as
// driver approvals) that change later. Admins' custom assignments are kept
// as they are; otherwise the app's placement is saved. Each signup's
// plannedShift keeps a copy, for reverting. Nobody is emailed.
//
// It runs when an admin page that shows assignments or counts from them
// loads, rather than on a schedule, so it's done for every event that has
// started before it's needed. It also runs first in every admin action that
// changes what the placement is worked out from (driver decisions, editing,
// publishing or unpublishing a form, a volunteer's build count, adding a
// reserved volunteer), so a change made after the day started can't alter
// it. Drivers count as they were on the day. Callers must run
// requireAdmin() first.

// Every published form that has closed and started, and whose placement
// isn't saved yet. Once per request.
export const saveStartedPlacements = cache(async () => {
  const now = new Date();
  const forms = await prisma.signupForm.findMany({
    where: {
      status: "PUBLISHED",
      placementSavedAt: null,
      closesAt: { lte: now },
      // The first build is on the form's day.
      date: { lte: fromDay(today()) },
    },
    select: {
      id: true,
      date: true,
      shifts: { where: { cancelledAt: null }, select: { startsAt: true } },
    },
  });
  for (const form of forms) {
    if (now >= cancelDeadline(toDay(form.date), form.shifts)) await savePlacement(form.id);
  }
});

async function savePlacement(formId: string) {
  const form = await getSignupForm(formId);
  if (!form) return;

  // Signup ID → the build they're going to, or null for not placed. With
  // custom assignments, each signup's assignedShift already says.
  const placement = new Map<string, string | null>();
  if (form.assignmentsSavedAt === null) {
    // Drivers as they were on the day: an approval that ended since still
    // counts. Admins' decisions since can't have changed it, since every
    // action that changes the placement saves it first.
    const roster = await getFormRoster(form.id, form.day, form.shifts, { driversOnDay: true });
    const active = roster.filter((signup) => !signup.cancelledAt && !signup.waitlistedAt);
    const plan = planForRoster(form.shifts, active, form);
    for (const signup of active) placement.set(signup.id, plan.placement.get(signup.id) ?? null);
  }

  await prisma.$transaction(async (tx) => {
    // Only if nothing changed since the plan was made: another request may
    // have saved it first, or an admin saved or reverted assignments.
    const claimed = await tx.signupForm.updateMany({
      where: { id: form.id, placementSavedAt: null, assignmentsSavedAt: form.assignmentsSavedAt },
      data: { placementSavedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const byShift = new Map<string | null, string[]>();
    for (const [signupId, shiftId] of placement) {
      byShift.set(shiftId, [...(byShift.get(shiftId) ?? []), signupId]);
    }
    for (const [assignedShiftId, ids] of byShift) {
      await tx.formSignup.updateMany({
        where: { id: { in: ids }, formId: form.id },
        data: { assignedShiftId },
      });
    }
    // Nobody cancelled or waiting is going anywhere, and a build that's
    // been cancelled isn't somewhere to go.
    await tx.formSignup.updateMany({
      where: {
        formId: form.id,
        OR: [
          { cancelledAt: { not: null } },
          { waitlistedAt: { not: null } },
          { assignedShift: { cancelledAt: { not: null } } },
        ],
      },
      data: { assignedShiftId: null },
    });
    await tx.$executeRaw`UPDATE "FormSignup" SET "plannedShiftId" = "assignedShiftId" WHERE "formId" = ${form.id}`;
  });
}

// Whether a form's signups' assignedShift says where they're going: admins
// saved custom assignments, or the app saved the planned ones when the
// first build started.
export function placementStored(form: {
  assignmentsSavedAt: Date | null;
  placementSavedAt: Date | null;
}) {
  return form.assignmentsSavedAt !== null || form.placementSavedAt !== null;
}

// Whether a form's Assignments tab shows the confirmed assignments: its
// planned ones were saved when its first build started, and the event
// wasn't cancelled.
export function confirmingAttendance(form: { status: string; placementSavedAt: Date | null }) {
  return form.status === "PUBLISHED" && form.placementSavedAt !== null;
}
