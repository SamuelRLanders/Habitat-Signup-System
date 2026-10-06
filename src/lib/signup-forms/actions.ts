"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { FormStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import {
  firstErrors,
  formValues,
  type ActionState,
  type FormState,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { parseSections, type SectionErrors } from "@/lib/sections";
import {
  addDays,
  DEFAULT_TIME_ZONE,
  formatDay,
  fromDay,
  toDay,
  zonedDateTime,
} from "@/lib/time";
import { offeredShifts, today } from "./queries";

// Every action calls requireAdmin() first: Server Actions can be called by
// anyone who sends a POST request, not only through our forms. IDs bound to
// an action are also sent by the browser, so they're treated as untrusted.

// Forms show up on admin pages, including each build's page. The public
// pages are rendered for each request, so they're always current.
function revalidateForms() {
  revalidatePath("/admin", "layout");
}

// ─── Creating and editing ────────────────────────────────────────────────────

const time = (message: string) => z.iso.time({ precision: -1, error: message });

const signupFormSchema = z.object({
  date: z.iso.date("Choose the event day."),
  opensDate: z.iso.date("Choose the day the form opens."),
  opensTime: time("Choose the time the form opens."),
  closesDate: z.iso.date("Choose the day the form closes."),
  closesTime: time("Choose the time the form closes."),
  description: z
    .string()
    .trim()
    .max(5000, "Keep the description under 5,000 characters.")
    .transform((value) => value || null),
});

export type SignupFormField = keyof z.input<typeof signupFormSchema>;
export type SignupFormState = FormState<SignupFormField> & {
  // Problems with the sections, by their position in the form.
  sectionErrors?: Record<number, SectionErrors>;
};

// Validates the fields and sections together, so every problem shows at
// once. Open and close times are in Indiana time, like the form's date.
// previousDay is the form's date before this edit: a form can keep a date
// that has passed, but can't be moved to one.
function parseSignupForm(formData: FormData, previousDay?: string) {
  const fields = signupFormSchema.safeParse(formValues(formData));
  const sections = parseSections(formData);

  const errors: SignupFormState["errors"] = fields.success ? {} : firstErrors(fields.error);
  let values = null;
  if (fields.success) {
    const { date, opensDate, opensTime, closesDate, closesTime, description } = fields.data;
    const opensAt = zonedDateTime(opensDate, opensTime, DEFAULT_TIME_ZONE);
    const closesAt = zonedDateTime(closesDate, closesTime, DEFAULT_TIME_ZONE);
    // Midnight at the end of the build day.
    const dayEnds = zonedDateTime(addDays(date, 1), "00:00", DEFAULT_TIME_ZONE);

    if (date !== previousDay && date < today()) {
      errors.date = "This day has already passed.";
    }
    if (closesAt <= opensAt) {
      errors.closesTime = "The form has to close after it opens.";
    } else if (closesAt > dayEnds) {
      errors.closesDate = "The form has to close by the end of the event day.";
    }
    values = { date: fromDay(date), opensAt, closesAt, description };
  }

  if (!values || Object.keys(errors).length > 0 || !sections.ok) {
    const state: SignupFormState = { errors };
    if (!sections.ok) {
      if (sections.form) errors.form = sections.form;
      if (sections.errors) state.sectionErrors = sections.errors;
    }
    return { ok: false as const, state };
  }
  return { ok: true as const, values, sections: sections.sections };
}

// The error for a date that already has a form, or null.
async function dateTaken(date: Date, exceptFormId?: string) {
  const existing = await prisma.signupForm.findUnique({
    where: { date },
    select: { id: true },
  });
  if (!existing || existing.id === exceptFormId) return null;
  return takenMessage(date);
}

function takenMessage(date: Date) {
  return `${formatDay(toDay(date), "short")} already has a signup form. There's one form per event.`;
}

function isDateConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createSignupForm(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const admin = await requireAdmin();

  const parsed = parseSignupForm(formData);
  if (!parsed.ok) return parsed.state;

  const taken = await dateTaken(parsed.values.date);
  if (taken) return { errors: { date: taken } };

  let form;
  try {
    form = await prisma.signupForm.create({
      data: {
        ...parsed.values,
        // A copy of the name, kept even if the admin's account changes.
        createdByName: admin.name || admin.email,
        createdById: admin.id,
        sections: { create: parsed.sections },
      },
    });
  } catch (error) {
    // Someone made a form for the same day at the same moment.
    if (isDateConflict(error)) return { errors: { date: takenMessage(parsed.values.date) } };
    throw error;
  }

  revalidateForms();
  redirect(`/admin/forms/${form.id}`);
}

export async function updateSignupForm(
  formId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  await requireAdmin();

  const existing = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: {
      date: true,
      _count: { select: { signups: { where: { cancelledAt: null } } } },
    },
  });
  if (!existing) return { errors: { form: "This form no longer exists." } };

  const parsed = parseSignupForm(formData, toDay(existing.date));
  if (!parsed.ok) return parsed.state;

  // Volunteers chose shifts on this day, so it has to stay put.
  if (existing._count.signups > 0 && parsed.values.date.getTime() !== existing.date.getTime()) {
    return {
      errors: { date: "Volunteers have signed up for this day, so the form can't move to another one." },
    };
  }

  const taken = await dateTaken(parsed.values.date, formId);
  if (taken) return { errors: { date: taken } };

  try {
    await prisma.signupForm.update({
      where: { id: formId },
      data: {
        ...parsed.values,
        // Sections aren't referenced by anything else, so they're replaced
        // wholesale with what the form sent.
        sections: { deleteMany: {}, create: parsed.sections },
      },
    });
  } catch (error) {
    if (isDateConflict(error)) return { errors: { date: takenMessage(parsed.values.date) } };
    throw error;
  }

  revalidateForms();
  redirect(`/admin/forms/${formId}`);
}

// ─── Publishing and deleting ─────────────────────────────────────────────────

const statusSchema = z.enum(FormStatus);

// A form can only be published with something to sign up for and time left
// to do it.
export async function setSignupFormStatus(
  formId: string,
  status: FormStatus,
): Promise<ActionState> {
  await requireAdmin();

  const next = statusSchema.safeParse(status);
  if (!next.success) return { error: "Unknown status." };

  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: { date: true, closesAt: true },
  });
  if (!form) return { error: "This form no longer exists." };

  if (next.data === "PUBLISHED") {
    if (form.closesAt <= new Date()) {
      return { error: "The form's close time has passed. Change it before publishing." };
    }
    const day = toDay(form.date);
    const shifts = (await offeredShifts([day])).get(day) ?? [];
    if (shifts.length === 0) {
      return { error: "There are no builds on this day. Add one to a project before publishing." };
    }
  }

  await prisma.signupForm.update({
    where: { id: formId },
    data: { status: next.data },
  });
  revalidateForms();
  return {};
}

// Only drafts can be deleted, so a form volunteers might have the link to
// doesn't vanish by accident, and only if nobody has signed up through it.
export async function deleteSignupForm(formId: string): Promise<ActionState> {
  await requireAdmin();

  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: { status: true, _count: { select: { signups: true } } },
  });
  if (form?.status === "PUBLISHED") {
    return { error: "Unpublish the form before deleting it." };
  }
  if (form && form._count.signups > 0) {
    return { error: "Volunteers have signed up through this form, so it can't be deleted." };
  }

  await prisma.signupForm.deleteMany({ where: { id: formId } });
  revalidateForms();
  redirect("/admin/forms");
}
