"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { BuildStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import { firstErrors, formValues, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  TIME_ZONES,
  toDateInput,
  toTimeInput,
  zonedDateTime,
} from "@/lib/time";

// Every action calls requireAdmin() first: Server Actions can be called by
// anyone who sends a POST request, not only through our forms. IDs bound to
// an action are also sent by the browser, so they're treated as untrusted.

export type ActionState = { error?: string };

// Refreshes every admin page, since build changes show up on the list page,
// the build page, and each shift's roster page.
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

// ─── Builds ──────────────────────────────────────────────────────────────────

const timeZoneValues = TIME_ZONES.map((zone) => zone.value) as [
  string,
  ...string[],
];

const buildSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Keep the name under 120 characters."),
  address: z.string().trim().min(1, "Enter an address.").max(300, "Keep the address under 300 characters."),
  description: z
    .string()
    .trim()
    .max(5000, "Keep the description under 5,000 characters.")
    .transform((value) => value || null),
  timeZone: z.enum(timeZoneValues, "Choose a time zone."),
});

export type BuildField = keyof z.input<typeof buildSchema>;
export type BuildFormState = FormState<BuildField>;

export async function createBuild(
  _prev: BuildFormState,
  formData: FormData,
): Promise<BuildFormState> {
  const admin = await requireAdmin();

  const values = formValues(formData);
  const parsed = buildSchema.safeParse(values);
  if (!parsed.success) return { errors: firstErrors(parsed.error) };

  const build = await prisma.build.create({
    data: { ...parsed.data, createdById: admin.id },
  });

  revalidateAdmin();
  redirect(`/admin/builds/${build.id}`);
}

export async function updateBuild(
  buildId: string,
  _prev: BuildFormState,
  formData: FormData,
): Promise<BuildFormState> {
  await requireAdmin();

  const values = formValues(formData);
  const parsed = buildSchema.safeParse(values);
  if (!parsed.success) return { errors: firstErrors(parsed.error) };

  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: { shifts: true },
  });
  if (!build) return { errors: { form: "This build no longer exists." } };

  const { timeZone } = parsed.data;
  await prisma.$transaction([
    prisma.build.update({ where: { id: buildId }, data: parsed.data }),
    // Changing the time zone fixes a mistake in how times were entered, so
    // shifts keep their clock times (8:00 AM stays 8:00 AM) in the new zone.
    ...(timeZone === build.timeZone
      ? []
      : build.shifts.map((shift) =>
          prisma.shift.update({
            where: { id: shift.id },
            data: {
              startsAt: moveToZone(shift.startsAt, build.timeZone, timeZone),
              endsAt: moveToZone(shift.endsAt, build.timeZone, timeZone),
            },
          }),
        )),
  ]);

  revalidateAdmin();
  redirect(`/admin/builds/${buildId}`);
}

function moveToZone(date: Date, from: string, to: string) {
  return zonedDateTime(toDateInput(date, from), toTimeInput(date, from), to);
}

const statusSchema = z.enum(BuildStatus);

// Publishing needs a shift to sign up for, and a build volunteers have
// signed up for can't be hidden again as a draft.
export async function setBuildStatus(
  buildId: string,
  status: BuildStatus,
): Promise<ActionState> {
  await requireAdmin();

  const next = statusSchema.safeParse(status);
  if (!next.success) return { error: "Unknown status." };

  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: {
      shifts: {
        where: { cancelledAt: null },
        select: {
          endsAt: true,
          _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
        },
      },
    },
  });
  if (!build) return { error: "This build no longer exists." };

  if (next.data === "PUBLISHED") {
    const now = new Date();
    if (!build.shifts.some((shift) => shift.endsAt >= now)) {
      return { error: "Add at least one upcoming shift before publishing." };
    }
  }
  if (next.data === "DRAFT") {
    const hasSignups = build.shifts.some((shift) => shift._count.signups > 0);
    if (hasSignups) {
      return {
        error:
          "Volunteers have already signed up, so this build can't go back to a draft. Close signups instead.",
      };
    }
  }

  await prisma.build.update({
    where: { id: buildId },
    data: { status: next.data },
  });
  revalidateAdmin();
  return {};
}

// Only builds nobody has signed up for can be deleted. Others are cancelled,
// which keeps the record of who signed up.
export async function deleteBuild(
  buildId: string,
): Promise<ActionState> {
  await requireAdmin();

  const signups = await prisma.signup.count({ where: { shift: { buildId } } });
  if (signups > 0) {
    return {
      error: "Volunteers have signed up for this build. Cancel it instead.",
    };
  }

  await prisma.build.deleteMany({ where: { id: buildId } });
  revalidateAdmin();
  redirect("/admin/builds");
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

// Adding shifts takes any number of dates, each becoming its own shift with
// the same times, spots, and notes. Editing a shift takes exactly one date.
const MAX_NEW_SHIFTS = 60;

const shiftDetailsSchema = z
  .object({
    startTime: z.iso.time({ precision: -1, error: "Choose a start time." }),
    endTime: z.iso.time({ precision: -1, error: "Choose an end time." }),
    capacity: z.coerce
      .number<string>("Enter the number of spots.")
      .int("Enter a whole number.")
      .min(1, "A shift needs at least 1 spot.")
      .max(500, "A shift can have at most 500 spots."),
    notes: z
      .string()
      .trim()
      .max(2000, "Keep notes under 2,000 characters.")
      .transform((value) => value || null),
  })
  .refine((shift) => shift.endTime > shift.startTime, {
    message: "The shift must end after it starts.",
    path: ["endTime"],
  });

const dateSchema = z.iso.date("Choose a valid date.");

const newShiftDatesSchema = z
  .array(dateSchema)
  .min(1, "Choose at least one date.")
  .max(MAX_NEW_SHIFTS, `Add at most ${MAX_NEW_SHIFTS} shifts at a time.`)
  .transform((dates) => [...new Set(dates)].sort());

const editedShiftDateSchema = z.array(dateSchema).length(1, "Choose a date.");

export type ShiftField = "date" | keyof z.input<typeof shiftDetailsSchema>;
export type ShiftFormState = FormState<ShiftField>;

// The form sends one "date" field per selected day.
function parseShifts(
  formData: FormData,
  datesSchema: typeof newShiftDatesSchema | typeof editedShiftDateSchema,
  timeZone: string,
) {
  const values = formValues(formData);
  const details = shiftDetailsSchema.safeParse(values);
  const dates = datesSchema.safeParse(formData.getAll("date"));
  if (!details.success || !dates.success) {
    const errors: ShiftFormState["errors"] = details.success
      ? {}
      : firstErrors(details.error);
    if (!dates.success) errors.date = dates.error.issues[0].message;
    return { ok: false as const, errors };
  }

  const { startTime, endTime, capacity, notes } = details.data;
  return {
    ok: true as const,
    shifts: dates.data.map((date) => ({
      startsAt: zonedDateTime(date, startTime, timeZone),
      endsAt: zonedDateTime(date, endTime, timeZone),
      capacity,
      notes,
    })),
  };
}

export async function createShifts(
  buildId: string,
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  await requireAdmin();

  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) return { errors: { form: "This build no longer exists." } };
  if (build.status === "CANCELLED") {
    return { errors: { form: "Shifts can't be added to a cancelled build." } };
  }

  const parsed = parseShifts(formData, newShiftDatesSchema, build.timeZone);
  if (!parsed.ok) return { errors: parsed.errors };

  const now = new Date();
  const past = parsed.shifts.filter((shift) => shift.startsAt < now);
  if (past.length > 0) {
    const days = past.map((s) => formatDate(s.startsAt, build.timeZone));
    return {
      errors: {
        date:
          past.length === 1
            ? `${days[0]} at this start time has already passed.`
            : `These dates have already passed at this start time: ${days.join("; ")}.`,
      },
    };
  }

  await prisma.shift.createMany({
    data: parsed.shifts.map((shift) => ({ ...shift, buildId })),
  });
  revalidateAdmin();
  return { success: true };
}

export async function updateShift(
  shiftId: string,
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  await requireAdmin();

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      build: true,
      signups: { where: { status: "CONFIRMED" }, select: { groupSize: true } },
    },
  });
  if (!existing) return { errors: { form: "This shift no longer exists." } };

  const parsed = parseShifts(formData, editedShiftDateSchema, existing.build.timeZone);
  if (!parsed.ok) return { errors: parsed.errors };
  const [shift] = parsed.shifts;

  const filled = existing.signups.reduce((sum, s) => sum + s.groupSize, 0);
  if (shift.capacity < filled) {
    return {
      errors: {
        capacity: `${filled} spots are already filled, so this shift needs at least ${filled} spots.`,
      },
    };
  }

  await prisma.shift.update({ where: { id: shiftId }, data: shift });
  revalidateAdmin();
  return { success: true };
}

// Deletes a shift nobody has signed up for. Otherwise cancels it, keeping the
// signups on record.
export async function removeShift(
  shiftId: string,
): Promise<ActionState> {
  await requireAdmin();

  const signups = await prisma.signup.count({ where: { shiftId } });
  if (signups === 0) {
    await prisma.shift.deleteMany({ where: { id: shiftId } });
  } else {
    await prisma.shift.updateMany({
      where: { id: shiftId },
      data: { cancelledAt: new Date() },
    });
  }
  revalidateAdmin();
  return {};
}

export async function restoreShift(
  shiftId: string,
): Promise<ActionState> {
  await requireAdmin();

  await prisma.shift.updateMany({
    where: { id: shiftId },
    data: { cancelledAt: null },
  });
  revalidateAdmin();
  return {};
}
