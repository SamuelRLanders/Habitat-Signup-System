"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { sendEventCancelled } from "@/lib/form-signups/emails";
import {
  firstErrors,
  formValues,
  type ActionState,
  type FormState,
} from "@/lib/forms";
import { parseBuilds, type BuildErrors, type BuildInput } from "@/lib/form-builds";
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
import { today } from "./queries";

// Every action calls requireAdmin() first: Server Actions can be called by
// anyone who sends a POST request, not only through our forms. IDs bound to
// an action are also sent by the browser, so they're treated as untrusted.

// Forms show up on several admin pages. The public pages are rendered for
// each request, so they're always current.
function revalidateForms() {
  revalidatePath("/admin", "layout");
}

// ─── Creating and editing ────────────────────────────────────────────────────

const time = (message: string) => z.iso.time({ precision: -1, error: message });
const yesNo = z.enum(["yes", "no"]).transform((value) => value === "yes");

const signupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for the form.")
    .max(120, "Keep the name under 120 characters."),
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
  // The switches, "yes" when on.
  listed: yesNo,
  askTransportation: yesNo,
  askGroups: yesNo,
});

export type SignupFormField = keyof z.input<typeof signupFormSchema>;
export type SignupFormState = FormState<SignupFormField> & {
  // Problems with the builds and sections, by their position in the form.
  buildErrors?: Record<number, BuildErrors>;
  sectionErrors?: Record<number, SectionErrors>;
};

// Validates the fields, builds and sections together, so every problem
// shows at once. Times are in Indiana time, like the form's date.
// previousDay is the form's date before this edit: a form can keep a date
// that has passed, but can't be moved to one.
function parseSignupForm(formData: FormData, previousDay?: string) {
  const fields = signupFormSchema.safeParse(formValues(formData));
  const builds = parseBuilds(formData);
  const sections = parseSections(formData);

  const errors: SignupFormState["errors"] = fields.success ? {} : firstErrors(fields.error);
  let values = null;
  if (fields.success) {
    const { date, opensDate, opensTime, closesDate, closesTime, ...rest } = fields.data;
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
    values = { ...rest, date: fromDay(date), opensAt, closesAt };
  }

  if (!values || Object.keys(errors).length > 0 || !builds.ok || !sections.ok) {
    const state: SignupFormState = { errors };
    if (!builds.ok) {
      if (builds.form) errors.form = builds.form;
      if (builds.errors) state.buildErrors = builds.errors;
    }
    if (!sections.ok) {
      if (sections.form) errors.form = sections.form;
      if (sections.errors) state.sectionErrors = sections.errors;
    }
    return { ok: false as const, state };
  }
  return { ok: true as const, values, builds: builds.builds, sections: sections.sections };
}

// A build's fields for the database, on the form's day.
function shiftData(build: BuildInput, date: Date) {
  const day = toDay(date);
  return {
    name: build.name,
    address: build.address,
    description: build.description,
    lunch: build.lunch,
    capacity: build.capacity,
    startsAt: zonedDateTime(day, build.startTime, DEFAULT_TIME_ZONE),
    endsAt: zonedDateTime(day, build.endTime, DEFAULT_TIME_ZONE),
  };
}

// The error for a name another form on the same day has, or null. Forms on
// a day are told apart by name, so each needs its own.
async function nameTaken(date: Date, name: string, exceptFormId?: string) {
  const existing = await prisma.signupForm.findFirst({
    where: {
      date,
      name: { equals: name, mode: "insensitive" },
      ...(exceptFormId && { id: { not: exceptFormId } }),
    },
    select: { id: true },
  });
  if (!existing) return null;
  return `Another form on ${formatDay(toDay(date), "short")} has this name.`;
}

export async function createSignupForm(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const admin = await requireAdmin();

  const parsed = parseSignupForm(formData);
  if (!parsed.ok) return parsed.state;

  const taken = await nameTaken(parsed.values.date, parsed.values.name);
  if (taken) return { errors: { name: taken } };

  const form = await prisma.signupForm.create({
    data: {
      ...parsed.values,
      // A copy of the name, kept even if the admin's account changes.
      createdByName: admin.name || admin.email,
      createdById: admin.id,
      // Every build is new, so any IDs or cancellations sent are ignored.
      shifts: { create: parsed.builds.map((build) => shiftData(build, parsed.values.date)) },
      sections: { create: parsed.sections },
    },
  });

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
      status: true,
      _count: { select: { signups: { where: { cancelledAt: null } } } },
    },
  });
  if (!existing) return { errors: { form: "This form no longer exists." } };
  if (existing.status === "CANCELLED") return { errors: { form: CANCELLED } };

  const parsed = parseSignupForm(formData, toDay(existing.date));
  if (!parsed.ok) return parsed.state;

  // Volunteers chose builds on this day, so it has to stay put.
  if (existing._count.signups > 0 && parsed.values.date.getTime() !== existing.date.getTime()) {
    return {
      errors: { date: "Volunteers have signed up for this day, so the form can't move to another one." },
    };
  }

  const taken = await nameTaken(parsed.values.date, parsed.values.name, formId);
  if (taken) return { errors: { name: taken } };

  const saved = await prisma.$transaction(async (tx) => {
    // Lock the form until this transaction ends, as a signup does, so its
    // builds don't change while someone is signing up for them.
    await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;

    const existing = await tx.shift.findMany({
      where: { formId },
      select: { id: true, cancelledAt: true, _count: { select: { preferences: true } } },
    });
    const byId = new Map(existing.map((shift) => [shift.id, shift]));
    const ids = parsed.builds.flatMap((build) => (build.id ? [build.id] : []));
    // Another admin removed a build, or the IDs were tampered with.
    if (new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) return false;

    await tx.signupForm.update({
      where: { id: formId },
      data: {
        ...parsed.values,
        // Sections aren't referenced by anything else, so they're replaced
        // wholesale with what the form sent.
        sections: { deleteMany: {}, create: parsed.sections },
      },
    });

    // Builds are matched by ID, since volunteers' choices point at them.
    // A build left out is deleted, or cancelled if volunteers chose it,
    // keeping the record; their choices count again if it's restored.
    const now = new Date();
    const kept = new Set(ids);
    for (const shift of existing) {
      if (kept.has(shift.id)) continue;
      if (shift._count.preferences === 0) {
        await tx.shift.delete({ where: { id: shift.id } });
      } else if (!shift.cancelledAt) {
        await tx.shift.update({ where: { id: shift.id }, data: { cancelledAt: now } });
      }
    }
    for (const build of parsed.builds) {
      const data = shiftData(build, parsed.values.date);
      if (!build.id) {
        await tx.shift.create({ data: { ...data, formId } });
        continue;
      }
      const cancelledAt = build.cancelled ? (byId.get(build.id)!.cancelledAt ?? now) : null;
      await tx.shift.update({ where: { id: build.id }, data: { ...data, cancelledAt } });
    }
    return true;
  });
  if (!saved) {
    return {
      errors: { form: "This form's builds were changed somewhere else. Refresh the page and make your changes again." },
    };
  }

  revalidateForms();
  redirect(`/admin/forms/${formId}`);
}

// ─── Publishing, cancelling and deleting ─────────────────────────────────────

const CANCELLED = "This event was cancelled, so its form can't be changed.";

// Cancelling is its own action, since it emails volunteers.
const statusSchema = z.enum(["DRAFT", "PUBLISHED"]);

// A form can only be published with something to sign up for and time left
// to do it.
export async function setSignupFormStatus(
  formId: string,
  status: z.infer<typeof statusSchema>,
): Promise<ActionState> {
  await requireAdmin();

  const next = statusSchema.safeParse(status);
  if (!next.success) return { error: "Unknown status." };

  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: {
      status: true,
      closesAt: true,
      _count: { select: { shifts: { where: { cancelledAt: null } } } },
    },
  });
  if (!form) return { error: "This form no longer exists." };
  if (form.status === "CANCELLED") return { error: CANCELLED };

  if (next.data === "PUBLISHED") {
    if (form.closesAt <= new Date()) {
      return { error: "The form's close time has passed. Change it before publishing." };
    }
    if (form._count.shifts === 0) {
      return { error: "This form has no builds. Edit the form to add one before publishing." };
    }
  }

  await prisma.signupForm.update({
    where: { id: formId },
    data: { status: next.data },
  });
  revalidateForms();
  return {};
}

// Cancels a day's event for good, and emails everyone signed up for it.
// The form stays as a record, telling volunteers who open it that the
// event is off. Admins are warned before this, since it sends email.
export async function cancelSignupForm(formId: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const result = await prisma.$transaction(async (tx) => {
    // Lock the form until this transaction ends, as a signup does, so
    // nobody signs up between reading who to email and cancelling.
    await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;

    const form = await tx.signupForm.findUnique({
      where: { id: formId },
      select: { name: true, date: true, status: true },
    });
    if (!form) return { error: "This form no longer exists." };
    if (form.status === "CANCELLED") return { error: "This event is already cancelled." };
    const day = toDay(form.date);
    if (day < today()) return { error: "This event has already happened." };

    await tx.signupForm.update({
      where: { id: formId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByName: admin.name || admin.email,
      },
    });
    const signups = await tx.formSignup.findMany({
      where: { formId, cancelledAt: null },
      select: { firstName: true, volunteer: { select: { email: true } } },
    });
    return {
      day,
      name: form.name,
      volunteers: signups.map((signup) => ({ to: signup.volunteer.email, firstName: signup.firstName })),
    };
  });
  if ("error" in result) return { error: result.error };

  revalidateForms();
  revalidatePath(`/signup/${formId}`);

  // The event is cancelled, so a failed email doesn't undo it.
  try {
    await sendEventCancelled(result.name, result.day, result.volunteers);
  } catch (error) {
    console.error("Failed to send event cancelled emails", error);
    return {
      error:
        "The event is cancelled, but the emails to volunteers didn't send. Download the volunteer list and email them yourself.",
    };
  }
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
  if (form?.status === "CANCELLED") {
    return { error: "Cancelled events are kept as a record, so they can't be deleted." };
  }
  if (form && form._count.signups > 0) {
    return { error: "Volunteers have signed up through this form, so it can't be deleted." };
  }

  await prisma.signupForm.deleteMany({ where: { id: formId } });
  revalidateForms();
  redirect("/admin/forms");
}
