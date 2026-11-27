import "server-only";
import { cache } from "react";
import { placementStored, savePastPlacements } from "@/lib/data/final-placement";
import { getFormRoster } from "@/lib/form-signups/rosters";
import { planForRoster } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { adminPhase } from "@/lib/signup-forms/phase";
import { getSignupForm } from "@/lib/signup-forms/queries";
import { formatDay, toDay } from "@/lib/time";

// What a signup form's tabs show, loaded once per request and shared by the
// layout and the tab's page. Callers must run requireAdmin() first.

export const loadForm = cache(async (formId: string) => {
  const form = await getSignupForm(formId);
  if (!form) return null;
  return { ...form, phase: adminPhase(form) };
});

// The form, everyone signed up, waiting or cancelled, and where those
// signed up are going: a likely
// placement (src/lib/placement), or admins' custom assignments once saved.
// Once the day is over, it's the placement saved then (custom is still
// whether admins made custom assignments; saved is whether either is
// stored).
export const loadFormPlan = cache(async (formId: string) => {
  // So a day that's over shows the placement the Data page counts.
  await savePastPlacements();
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
  return { form, active, waiting, cancelled, custom, saved, plan };
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
