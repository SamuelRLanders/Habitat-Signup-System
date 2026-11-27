import "server-only";
import { cache } from "react";
import { confirmingAttendance, placementStored, saveStartedPlacements } from "@/lib/data/final-placement";
import { getFormRoster } from "@/lib/form-signups/rosters";
import { planForRoster } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { adminPhase } from "@/lib/signup-forms/phase";
import { getSignupForm } from "@/lib/signup-forms/queries";
import { formatDay, toDay } from "@/lib/time";

// What a signup form's tabs show, loaded once per request and shared by the
// layout and the tab's page. Callers must run requireAdmin() first.

// The form, its phase, and whether its Assignments tab shows the confirmed
// assignments (once its first build has started) rather than the planned
// ones.
export const loadForm = cache(async (formId: string) => {
  // So an event that has started shows its confirmed assignments.
  await saveStartedPlacements();
  const form = await getSignupForm(formId);
  if (!form) return null;
  return { ...form, phase: adminPhase(form), confirming: confirmingAttendance(form) };
});

// The form, everyone signed up, waiting or cancelled, and where those
// signed up are going: a likely placement (src/lib/placement), or admins'
// custom assignments once saved. Once the first build has started, it's
// the confirmed assignments (custom is still whether admins made custom
// assignments; saved is whether either is stored). reservations are the
// spots reserved at the builds the form offers, oldest first, with whether
// their volunteer has signed up with them, and has ever signed up at all
// (known), so admins can add them after the form closes.
export const loadFormPlan = cache(async (formId: string) => {
  const form = await loadForm(formId);
  if (!form) return null;
  const roster = await getFormRoster(form.id, form.day, form.shifts);
  const active = roster.filter((signup) => !signup.cancelledAt && !signup.waitlistedAt);
  // On the waitlist, in the order they joined.
  const waiting = roster
    .filter((signup) => !signup.cancelledAt && signup.waitlistedAt)
    .sort((a, b) => a.waitlistedAt!.getTime() - b.waitlistedAt!.getTime());
  const cancelled = roster.filter((signup) => signup.cancelledAt);
  const custom = form.assignmentsSavedAt !== null;
  const saved = placementStored(form);
  const plan = planForRoster(form.shifts, active, form, saved);
  const reservations = await prisma.reservation.findMany({
    where: { formId, shiftId: { in: form.shifts.map((shift) => shift.id) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, shiftId: true, signupId: true },
  });
  const known = new Set(
    (
      await prisma.volunteer.findMany({
        where: { email: { in: reservations.map((reservation) => reservation.email) } },
        select: { email: true },
      })
    ).map((volunteer) => volunteer.email),
  );
  return {
    form,
    active,
    waiting,
    cancelled,
    custom,
    saved,
    plan,
    reservations: reservations.map((reservation) => ({ ...reservation, known: known.has(reservation.email) })),
  };
});

// "Volunteers: Delta Gamma build, Oct 24", for a tab's page title.
export async function formTitle(formId: string, tab?: string) {
  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: { name: true, date: true },
  });
  if (!form) return "Signup form";
  const title = `${form.name}, ${formatDay(toDay(form.date), "short")}`;
  return tab ? `${tab}: ${title}` : title;
}
