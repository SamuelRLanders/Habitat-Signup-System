"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireEditor } from "@/lib/auth/dal";
import { saveStartedPlacements } from "@/lib/data/final-placement";
import { fillFromWaitlist } from "@/lib/form-signups/waitlist";
import {
  firstErrors,
  formValues,
  type ActionState,
  type FormState,
} from "@/lib/forms";
import { parseBuilds, type BuildErrors, type BuildInput } from "@/lib/form-builds";
import { loadPlacementDay } from "@/lib/placement/load";
import { leftOutCount } from "@/lib/placement/solver";
import { prisma } from "@/lib/prisma";
import { ReservationProblem, reservationConflicts, saveReservations } from "@/lib/reservations/save";
import { parseSections, type SectionErrors } from "@/lib/sections";
import {
  addDays,
  DEFAULT_TIME_ZONE,
  formatDay,
  formatWeekdayTime,
  fromDay,
  toDay,
  zonedDateTime,
} from "@/lib/time";
import { offeredShifts, today } from "./queries";

// Every action calls requireEditor() first: Server Actions can be called by
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
  waitlist: yesNo,
  cancellationEmails: yesNo,
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
    } else if (builds.ok) {
      // The day is underway once its first build starts: the planned
      // assignments are saved and nobody can cancel (cancelDeadline()).
      // So a form can't still be open then, or be opened again afterwards.
      // One that has already closed is left as it is, so a past event can
      // still be edited.
      const starts = builds.builds
        .filter((build) => !build.cancelled)
        .map((build) => zonedDateTime(date, build.startTime, DEFAULT_TIME_ZONE).getTime());
      const firstStart = starts.length > 0 ? new Date(Math.min(...starts)) : null;
      if (firstStart && closesAt > firstStart && closesAt > new Date()) {
        errors.closesTime = `The form has to close by the time the day's first build starts, ${formatWeekdayTime(firstStart, DEFAULT_TIME_ZONE)}.`;
      }
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
    responsibleId: build.responsibleId,
    name: build.name,
    address: build.address,
    description: build.description,
    lunch: build.lunch,
    capacity: build.capacity,
    startsAt: zonedDateTime(day, build.startTime, DEFAULT_TIME_ZONE),
    endsAt: zonedDateTime(day, build.endTime, DEFAULT_TIME_ZONE),
  };
}

// Problems with the builds' responsible admins, by position: each has to
// be an editor or the owner (viewers can't organize a build), or null if
// they all are.
async function responsibleErrors(builds: BuildInput[]): Promise<SignupFormState | null> {
  const ids = [...new Set(builds.map((build) => build.responsibleId))];
  const editors = await prisma.user.findMany({
    where: { id: { in: ids }, role: { in: ["OWNER", "EDITOR"] } },
    select: { id: true },
  });
  const allowed = new Set(editors.map((editor) => editor.id));
  const buildErrors: Record<number, BuildErrors> = {};
  builds.forEach((build, index) => {
    if (!allowed.has(build.responsibleId)) {
      buildErrors[index] = { responsibleId: "Choose an editor or the owner. This admin may have been removed or made a viewer." };
    }
  });
  return Object.keys(buildErrors).length > 0 ? { buildErrors } : null;
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
  const admin = await requireEditor();

  const parsed = parseSignupForm(formData);
  if (!parsed.ok) return parsed.state;
  const badAdmins = await responsibleErrors(parsed.builds);
  if (badAdmins) return badAdmins;

  const taken = await nameTaken(parsed.values.date, parsed.values.name);
  if (taken) return { errors: { name: taken } };
  const conflicts = await reservationConflicts(prisma, parsed.builds, parsed.values.date);
  if (conflicts) return { buildErrors: conflicts };

  // A copy of the name, kept even if the admin's account changes.
  const createdByName = admin.name || admin.email;
  let form;
  try {
    form = await prisma.$transaction(async (tx) => {
      const form = await tx.signupForm.create({
        data: {
          ...parsed.values,
          createdByName,
          createdById: admin.id,
          sections: { create: parsed.sections },
        },
      });
      // Every build is new, so any IDs or cancellations sent are ignored.
      const builds = parsed.builds.map((build) => ({ ...build, cancelled: false }));
      const shiftIds: string[] = [];
      for (const build of builds) {
        const shift = await tx.shift.create({
          data: { ...shiftData(build, parsed.values.date), formId: form.id },
          select: { id: true },
        });
        shiftIds.push(shift.id);
      }
      await saveReservations(tx, form.id, builds, shiftIds, { createdByName, locked: false });
      return form;
    });
  } catch (error) {
    if (error instanceof ReservationProblem) return problemState(error);
    throw error;
  }

  revalidateForms();
  redirect(`/admin/forms/${form.id}`);
}

// The form editor's state for reserved spots that couldn't be saved.
function problemState(problem: ReservationProblem): SignupFormState {
  return problem.buildErrors ? { buildErrors: problem.buildErrors } : { errors: { form: problem.message } };
}

export async function updateSignupForm(
  formId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const admin = await requireEditor();
  // Before any change, so an edit after the day started can't alter
  // where people went.
  await saveStartedPlacements();

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
  const badAdmins = await responsibleErrors(parsed.builds);
  if (badAdmins) return badAdmins;

  // Volunteers chose builds on this day, so it has to stay put.
  if (existing._count.signups > 0 && parsed.values.date.getTime() !== existing.date.getTime()) {
    return {
      errors: { date: "Volunteers have signed up for this day, so the form can't move to another one." },
    };
  }

  const taken = await nameTaken(parsed.values.date, parsed.values.name, formId);
  if (taken) return { errors: { name: taken } };
  const conflicts = await reservationConflicts(prisma, parsed.builds, parsed.values.date, formId);
  if (conflicts) return { buildErrors: conflicts };

  const anySignups = existing._count.signups > 0;
  let saved;
  try {
    saved = await prisma.$transaction(async (tx) => {
    // Lock the form until this transaction ends, as a signup does, so its
    // builds don't change while someone is signing up for them.
    await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
    const before = await tx.signupForm.findUniqueOrThrow({
      where: { id: formId },
      select: {
        askTransportation: true,
        placementSavedAt: true,
        shifts: { where: offeredShifts.where, select: { id: true, capacity: true, _count: offeredShifts.select._count } },
      },
    });
    // How many signed-up volunteers can't be placed before this edit, to
    // check that new reserved spots have room. Only worth working out
    // with someone signed up.
    const leftOutBefore =
      anySignups
        ? leftOutCount(await loadPlacementDay(tx, formId, before.shifts, before.askTransportation))
        : 0;

    const existing = await tx.shift.findMany({
      where: { formId },
      select: { id: true, cancelledAt: true, capacity: true, _count: { select: { preferences: true } } },
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
    const shiftIds: string[] = [];
    for (const build of parsed.builds) {
      const data = shiftData(build, parsed.values.date);
      if (!build.id) {
        const created = await tx.shift.create({ data: { ...data, formId }, select: { id: true } });
        shiftIds.push(created.id);
        continue;
      }
      const cancelledAt = build.cancelled ? (byId.get(build.id)!.cancelledAt ?? now) : null;
      await tx.shift.update({ where: { id: build.id }, data: { ...data, cancelledAt } });
      shiftIds.push(build.id);
    }

    const reservations = await saveReservations(tx, formId, parsed.builds, shiftIds, {
      createdByName: admin.name || admin.email,
      locked: before.placementSavedAt !== null,
    });
    // A new reserved spot needs room: it can't leave out anyone signed up
    // who could be placed before.
    if (reservations.added.size > 0 && anySignups) {
      const shifts = await tx.shift.findMany({
        where: { formId, ...offeredShifts.where },
        select: { id: true, capacity: true, _count: offeredShifts.select._count },
      });
      const leftOutAfter = leftOutCount(await loadPlacementDay(tx, formId, shifts, parsed.values.askTransportation));
      if (leftOutBefore !== null && leftOutAfter !== null && leftOutAfter > leftOutBefore) {
        const buildErrors: Record<number, BuildErrors> = {};
        shiftIds.forEach((id, index) => {
          if (reservations.added.has(id)) {
            buildErrors[index] = {
              reservations:
                "There isn't room for this reserved spot: the volunteers already signed up need the build's other spots. Add spots to the build first.",
            };
          }
        });
        throw new ReservationProblem("", buildErrors);
      }
    }

    // A build with more spots, or a reserved spot given back, may have
    // room for people on the waitlist, who are added while the form is
    // open. Nobody is emailed.
    const moreSpots = parsed.builds.some(
      (build) => build.id && !build.cancelled && build.capacity > byId.get(build.id)!.capacity,
    );
    if (moreSpots || reservations.released) await fillFromWaitlist(tx, formId);
    return true;
    // Placing the waitlist can take longer than the default 5 seconds.
    }, { timeout: 20_000 });
  } catch (error) {
    if (error instanceof ReservationProblem) return problemState(error);
    throw error;
  }
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
  await requireEditor();
  // Only published forms' placements are saved, so save one before it's
  // unpublished.
  await saveStartedPlacements();

  const next = statusSchema.safeParse(status);
  if (!next.success) return { error: "Unknown status." };

  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: {
      status: true,
      closesAt: true,
      shifts: { where: { cancelledAt: null }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
    },
  });
  if (!form) return { error: "This form no longer exists." };
  if (form.status === "CANCELLED") return { error: CANCELLED };

  if (next.data === "PUBLISHED") {
    if (form.closesAt <= new Date()) {
      return { error: "The form's close time has passed. Change it before publishing." };
    }
    const [first] = form.shifts;
    if (!first) {
      return { error: "This form has no builds. Edit the form to add one before publishing." };
    }
    // As when saving the form (parseSignupForm()), for a form saved before
    // that was checked.
    if (form.closesAt > first.startsAt) {
      return { error: "The form closes after the day's first build starts. Change its close time before publishing." };
    }
  }

  await prisma.signupForm.update({
    where: { id: formId },
    data: { status: next.data },
  });
  revalidateForms();
  return {};
}

// Cancels a day's event for good. The form stays as a record, telling
// volunteers who open it that the event is off. Nobody is emailed: admins
// contact the volunteers themselves.
export async function cancelSignupForm(formId: string): Promise<ActionState> {
  const admin = await requireEditor();

  const result = await prisma.$transaction(async (tx) => {
    // Lock the form until this transaction ends, as a signup does, so
    // nobody signs up while it's being cancelled.
    await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;

    const form = await tx.signupForm.findUnique({
      where: { id: formId },
      select: { name: true, date: true, status: true },
    });
    if (!form) return { error: "This form no longer exists." };
    if (form.status === "CANCELLED") return { error: "This event is already cancelled." };
    if (toDay(form.date) < today()) return { error: "This event has already happened." };

    await tx.signupForm.update({
      where: { id: formId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByName: admin.name || admin.email,
      },
    });
    return {};
  });
  if ("error" in result) return { error: result.error };

  revalidateForms();
  revalidatePath(`/signup/${formId}`);
  return {};
}

// Only drafts can be deleted, so a form volunteers might have the link to
// doesn't vanish by accident, and only if nobody has signed up through it.
export async function deleteSignupForm(formId: string): Promise<ActionState> {
  await requireEditor();

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
