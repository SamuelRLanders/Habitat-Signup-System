"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getUser } from "@/lib/auth/dal";
import { firstErrors, formValues } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { profileSchema, required, saveProfile } from "@/lib/profile";
import { clientIp, clientUserAgent } from "@/lib/request";
import { formatDate, formatTimeRange } from "@/lib/time";
import { MAX_GROUP_SIZE, oldEnoughForAll, TOO_YOUNG } from "@/lib/volunteers";
import { sendSignupConfirmation } from "./emails";
import { getActiveWaiver, spotsTaken } from "./queries";

// The signup form. Only signed-in volunteers can submit it, but anything
// can be posted, so everything is checked here, including that the build is
// open and each shift has room.

const signupSchema = profileSchema.extend({
  signupType: z.enum(["individual", "group"], "Choose who you're signing up."),
  groupName: z
    .string()
    .trim()
    .max(100, "Keep this under 100 characters.")
    .optional()
    .transform((value) => value || null),
  waiverId: z.string("Refresh the page and try again.").min(1),
  signedName: required(
    "Type your full legal name to agree to the waiver.",
    200,
  ),
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
  | keyof z.input<typeof signupSchema>
  | "groupSize"
  | "shifts";

export type SignupFormState = {
  errors?: Partial<Record<SignupField | "form", string>>;
  // Problems with particular shifts (full, already signed up), by shift ID.
  shiftErrors?: Record<string, string>;
  success?: {
    email: string;
    groupSize: number;
    shifts: { id: string; date: string; time: string }[];
    // The link group members use to sign their waivers. Groups only.
    waiverPath: string | null;
  };
};

export async function submitSignup(
  buildId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const user = await getUser();
  if (!user) {
    return {
      errors: {
        form: "You've been signed out. Refresh the page and sign in again. Your answers will need to be re-entered.",
      },
    };
  }

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

  const { signupType, groupName, waiverId, signedName, ...profile } =
    parsed.data;
  const size =
    signupType === "group" && groupSize?.success ? groupSize.data : 1;

  // ── Check the build, the waiver, and the chosen shifts.
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { status: true, timeZone: true, name: true, address: true },
  });
  if (!build || build.status !== "PUBLISHED") {
    return {
      errors: { form: "This build isn't accepting signups right now." },
    };
  }

  const waiver = await getActiveWaiver();
  if (!waiver) {
    return {
      errors: { form: "Signups aren't open yet. Please check back soon." },
    };
  }
  if (waiver.id !== waiverId) {
    return {
      errors: {
        signedName:
          "The waiver was updated while you were filling this in. Refresh the page to read the new version.",
      },
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

  if (!oldEnoughForAll(profile.dateOfBirth, shifts, build.timeZone)) {
    return { errors: { dateOfBirth: TOO_YOUNG } };
  }

  const ipAddress = await clientIp();
  const userAgent = await clientUserAgent();

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
                userId: true,
                registration: { select: { size: true } },
              },
            },
          },
        });

        const shiftErrors: Record<string, string> = {};
        for (const shift of current) {
          if (shift.signups.some((s) => s.userId === user.id)) {
            shiftErrors[shift.id] = "You're already signed up for this shift.";
            continue;
          }
          const left = shift.capacity - spotsTaken(shift.signups);
          if (left < size) {
            shiftErrors[shift.id] =
              left <= 0
                ? "This shift just filled up."
                : `Only ${left} ${left === 1 ? "spot is" : "spots are"} left, not enough for your group of ${size}.`;
          }
        }
        if (Object.keys(shiftErrors).length > 0) return { shiftErrors };

        // Save the details as the volunteer's profile, for next time.
        await saveProfile(tx, user.id, profile);

        const registration = await tx.registration.create({
          data: {
            buildId,
            leaderId: user.id,
            size,
            groupName: size > 1 ? groupName : null,
            waiverToken: size > 1 ? randomBytes(18).toString("base64url") : null,
          },
        });

        for (const shift of shifts) {
          // A volunteer who cancelled a shift and signs up again reuses their
          // old signup row, since there's one per volunteer and shift. It
          // moves to the new registration.
          await tx.signup.upsert({
            where: { shiftId_userId: { shiftId: shift.id, userId: user.id } },
            create: {
              shiftId: shift.id,
              userId: user.id,
              registrationId: registration.id,
            },
            update: {
              registrationId: registration.id,
              status: "CONFIRMED",
              cancelledAt: null,
            },
          });
        }

        await tx.waiverAcceptance.create({
          data: {
            signedName,
            ipAddress,
            userAgent,
            waiverId: waiver.id,
            registrationId: registration.id,
            userId: user.id,
          },
        });

        return { shiftErrors: null, waiverToken: registration.waiverToken };
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

  const shiftTimes = shifts.map((shift) => ({
    id: shift.id,
    date: formatDate(shift.startsAt, build.timeZone),
    time: formatTimeRange(shift.startsAt, shift.endsAt, build.timeZone),
  }));
  const waiverPath = result.waiverToken ? `/waiver/${result.waiverToken}` : null;

  // The signup is saved, so a failed email doesn't undo it: the volunteer
  // still sees the confirmation, and their signups are on their page.
  try {
    await sendSignupConfirmation({
      to: user.email,
      firstName: profile.firstName,
      build,
      size,
      shifts: shiftTimes,
      waiverPath,
    });
  } catch (error) {
    console.error("Failed to send signup confirmation", error);
  }

  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/admin", "layout");

  return {
    success: {
      email: user.email,
      groupSize: size,
      shifts: shiftTimes,
      waiverPath,
    },
  };
}
