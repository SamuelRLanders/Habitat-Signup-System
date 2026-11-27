import "server-only";
import { cache } from "react";
import { getFormRoster } from "@/lib/form-signups/rosters";
import { planForRoster } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { getSignupForm, today } from "@/lib/signup-forms/queries";
import { fromDay } from "@/lib/time";

// Saves where everyone went on each event day that's over
// (SignupForm.placementSavedAt), so the Data page's numbers don't shift
// later: until it's saved, a form without custom assignments is placed
// afresh each time, from details (such as driver approvals) that change
// after the day. Admins' custom assignments are kept as they are; otherwise
// the app's placement is saved. Nobody is emailed.
//
// It runs when an admin page that counts from it loads, rather than on a
// schedule, so it's done for every day that's over before it's needed.
// Callers must run requireAdmin() first.

// Every published form whose day is over and whose placement isn't saved
// yet. Once per request.
export const savePastPlacements = cache(async () => {
  const forms = await prisma.signupForm.findMany({
    where: { status: "PUBLISHED", date: { lt: fromDay(today()) }, placementSavedAt: null },
    select: { id: true },
  });
  for (const { id } of forms) await savePlacement(id);
});

async function savePlacement(formId: string) {
  const form = await getSignupForm(formId);
  if (!form) return;

  // Signup ID → the build they're going to, or null for not placed. With
  // custom assignments, each signup's assignedShift already says.
  const placement = new Map<string, string | null>();
  if (form.assignmentsSavedAt === null) {
    const roster = await getFormRoster(form.id, form.day, form.shifts);
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
  });
}

// Whether a form's signups' assignedShift says where they're going: admins
// saved custom assignments, or the app saved its placement after the day.
export function placementStored(form: {
  assignmentsSavedAt: Date | null;
  placementSavedAt: Date | null;
}) {
  return form.assignmentsSavedAt !== null || form.placementSavedAt !== null;
}
