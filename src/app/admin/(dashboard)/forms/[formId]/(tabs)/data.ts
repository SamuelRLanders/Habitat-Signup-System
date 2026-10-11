import "server-only";
import { cache } from "react";
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

// The form, everyone who signed up, and where they're going: a likely
// placement (src/lib/placement), or admins' custom assignments once saved.
export const loadFormPlan = cache(async (formId: string) => {
  const form = await loadForm(formId);
  if (!form) return null;
  const roster = await getFormRoster(form.id, form.day, form.shifts);
  const active = roster.filter((signup) => !signup.cancelledAt);
  const cancelled = roster.filter((signup) => signup.cancelledAt);
  const custom = form.assignmentsSavedAt !== null;
  const plan = planForRoster(form.shifts, active, form, custom);
  return { form, active, cancelled, custom, plan };
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
