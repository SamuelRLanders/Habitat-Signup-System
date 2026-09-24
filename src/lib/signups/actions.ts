"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { firstErrors, formValues } from "@/lib/forms";
import { normalizeUsPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTimeRange, toDateInput } from "@/lib/time";
import { MAX_GROUP_SIZE, MINIMUM_AGE } from "@/lib/volunteers";

// The public signup form. Anyone can call this, so everything is checked
// here, including that the build is open and each shift has room.

const phone = (message: string) =>
  z.string().transform((value, ctx) => {
    const normalized = normalizeUsPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return normalized;
  });

const required = (message: string, max: number) =>
  z
    .string(message)
    .trim()
    .min(1, message)
    .max(max, `Keep this under ${max} characters.`);

// Empty means the volunteer skipped the question.
const optionalChoice = <const T extends readonly [string, ...string[]]>(
  values: T,
) =>
  z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((value) => value || null);

const signupSchema = z.object({
  signupType: z.enum(["individual", "group"], "Choose who you're signing up."),
  firstName: required("Enter your first name.", 100),
  lastName: required("Enter your last name.", 100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  phone: phone("Enter a 10-digit US phone number."),
  address: required("Enter your home address.", 300),
  emergencyContactName: required("Enter an emergency contact's name.", 200),
  emergencyContactPhone: phone("Enter a 10-digit US phone number."),
  dateOfBirth: z.iso
    .date("Enter your birthday.")
    .refine((date) => date >= "1900-01-01", "Enter a valid birthday.")
    .refine(
      (date) => date <= new Date().toISOString().slice(0, 10),
      "Your birthday can't be in the future.",
    ),
  sex: optionalChoice(["FEMALE", "MALE"]),
  tShirtSize: optionalChoice(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]),
});

const groupSizeSchema = z.coerce
  .number<string>("Enter how many people are in your group.")
  .int("Enter a whole number.")
  .min(2, "A group has at least 2 people. For just you, choose “Just me”.")
  .max(MAX_GROUP_SIZE, `Groups can have at most ${MAX_GROUP_SIZE} people.`);

const shiftIdsSchema = z
  .array(z.string().min(1))
  .min(1, "Choose at least one shift.")
  .max(100)
  .transform((ids) => [...new Set(ids)]);

export type SignupField =
  keyof z.input<typeof signupSchema> | "groupSize" | "shifts";

export type SignupFormState = {
  errors?: Partial<Record<SignupField | "form", string>>;
  // Problems with particular shifts (full, already signed up), by shift ID.
  shiftErrors?: Record<string, string>;
  success?: {
    email: string;
    groupSize: number;
    shifts: { id: string; date: string; time: string }[];
  };
};

export async function submitSignup(
  buildId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const values = formValues(formData);

  // ── Check the form itself.
  const parsed = signupSchema.safeParse(values);
  const isGroup = values.signupType === "group";
  const groupSize = isGroup
    ? groupSizeSchema.safeParse(values.groupSize)
    : null;
  const shiftIds = shiftIdsSchema.safeParse(formData.getAll("shiftId"));

  if (!parsed.success || groupSize?.success === false || !shiftIds.success) {
    const errors: SignupFormState["errors"] = parsed.success
      ? {}
      : firstErrors(parsed.error);
    if (groupSize?.success === false) {
      errors.groupSize = groupSize.error.issues[0].message;
    }
    if (!shiftIds.success) errors.shifts = shiftIds.error.issues[0].message;
    return { errors };
  }

  const { signupType, ...volunteer } = parsed.data;
  // Stored as a date column; midnight UTC keeps the same calendar day.
  const volunteerData = {
    ...volunteer,
    dateOfBirth: new Date(`${volunteer.dateOfBirth}T00:00:00Z`),
  };
  const size =
    signupType === "group" && groupSize?.success ? groupSize.data : 1;

  // ── Check the build and the chosen shifts.
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { status: true, timeZone: true },
  });
  if (!build || build.status !== "PUBLISHED") {
    return {
      errors: { form: "This build isn't accepting signups right now." },
    };
  }

  const shifts = await prisma.shift.findMany({
    where: {
      id: { in: shiftIds.data },
      buildId,
      cancelledAt: null,
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });
  if (shifts.length !== shiftIds.data.length) {
    return {
      errors: {
        shifts:
          "One of the shifts you chose is no longer available. Refresh the page to see the current shifts.",
      },
    };
  }

  // Old enough on the day of every shift. Dates are compared as YYYY-MM-DD
  // strings, which sort the same way as the dates they represent.
  const birthYear = Number(volunteer.dateOfBirth.slice(0, 4));
  const adultOn = `${birthYear + MINIMUM_AGE}${volunteer.dateOfBirth.slice(4)}`;
  if (
    shifts.some(
      (shift) => toDateInput(shift.startsAt, build.timeZone) < adultOn,
    )
  ) {
    return {
      errors: {
        dateOfBirth: `Volunteers must be ${MINIMUM_AGE} or older on the day of their shift.`,
      },
    };
  }

  // ── Save, making sure every shift still has room for the whole group.
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // Lock the chosen shifts until this transaction ends. Anyone else
        // signing up for them at the same moment waits here, then sees these
        // spots as taken.
        await tx.$queryRaw`SELECT id FROM "Shift" WHERE id IN (${Prisma.join(shiftIds.data)}) FOR UPDATE`;

        const current = await tx.shift.findMany({
          where: { id: { in: shiftIds.data } },
          select: {
            id: true,
            capacity: true,
            signups: {
              where: { status: "CONFIRMED" },
              select: {
                groupSize: true,
                volunteer: { select: { email: true } },
              },
            },
          },
        });

        const shiftErrors: Record<string, string> = {};
        for (const shift of current) {
          if (
            shift.signups.some((s) => s.volunteer.email === volunteer.email)
          ) {
            shiftErrors[shift.id] = "You're already signed up for this shift.";
            continue;
          }
          const filled = shift.signups.reduce((sum, s) => sum + s.groupSize, 0);
          const left = shift.capacity - filled;
          if (left < size) {
            shiftErrors[shift.id] =
              left <= 0
                ? "This shift just filled up."
                : `Only ${left} ${left === 1 ? "spot is" : "spots are"} left, not enough for your group of ${size}.`;
          }
        }
        if (Object.keys(shiftErrors).length > 0) return { shiftErrors };

        const { id: volunteerId } = await tx.volunteer.upsert({
          where: { email: volunteer.email },
          create: volunteerData,
          update: volunteerData,
        });

        for (const shift of shifts) {
          // A volunteer who cancelled before and signs up again reuses their
          // old signup row, since there's one per volunteer and shift.
          await tx.signup.upsert({
            where: { shiftId_volunteerId: { shiftId: shift.id, volunteerId } },
            create: { shiftId: shift.id, volunteerId, groupSize: size },
            update: { status: "CONFIRMED", groupSize: size, cancelledAt: null },
          });
        }
        return { shiftErrors: null };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    console.error("Signup failed", error);
    return {
      errors: {
        form: "Something went wrong saving your signup. Please try again in a moment.",
      },
    };
  }

  if (result.shiftErrors) {
    return {
      errors: {
        shifts:
          "Some of the shifts you chose can't take your signup. See the notes below.",
      },
      shiftErrors: result.shiftErrors,
    };
  }

  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/admin", "layout");

  return {
    success: {
      email: volunteer.email,
      groupSize: size,
      shifts: shifts.map((shift) => ({
        id: shift.id,
        date: formatDate(shift.startsAt, build.timeZone),
        time: formatTimeRange(shift.startsAt, shift.endsAt, build.timeZone),
      })),
    },
  };
}
