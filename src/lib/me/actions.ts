"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getUser } from "@/lib/auth/dal";
import {
  firstErrors,
  formValues,
  type ActionState,
  type FormState,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { profileSchema, saveProfile, type ProfileField } from "@/lib/profile";
import { spotsTaken } from "@/lib/signups/queries";
import { formatDate, formatTimeRange } from "@/lib/time";
import { MAX_GROUP_SIZE } from "@/lib/volunteers";

// Actions a volunteer takes on their own page. Anyone can post to a Server
// Action, and IDs bound to an action come from the browser, so every action
// checks the signup or registration belongs to the signed-in user.

const SIGNED_OUT = "You've been signed out. Refresh the page and sign in again.";

function refresh(buildId: string) {
  revalidatePath("/me");
  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/admin", "layout");
}

// Cancels one shift of a registration. For a group, the whole group's spots
// on that shift are freed; its other shifts are unaffected.
export async function cancelSignup(signupId: string): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: SIGNED_OUT };

  const signup = await prisma.signup.findFirst({
    where: { id: signupId, userId: user.id },
    select: {
      status: true,
      shift: {
        select: { startsAt: true, buildId: true, build: { select: { status: true } } },
      },
    },
  });
  if (!signup) return { error: "We couldn't find that signup." };
  if (signup.shift.build.status === "CANCELLED") {
    return { error: "Habitat cancelled this build, so there's nothing to cancel." };
  }
  if (signup.status === "CANCELLED") {
    return { error: "This signup is already cancelled." };
  }
  if (signup.shift.startsAt <= new Date()) {
    return { error: "This shift has already started, so it can't be cancelled." };
  }

  await prisma.signup.update({
    where: { id: signupId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  refresh(signup.shift.buildId);
  return {};
}

// Hides a registration's card from the volunteer's page after Habitat
// cancelled its build. Only whole cancelled builds can be dismissed; a single
// cancelled shift stays on the card.
export async function dismissCancelledBuild(
  registrationId: string,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: SIGNED_OUT };

  const { count } = await prisma.registration.updateMany({
    where: {
      id: registrationId,
      leaderId: user.id,
      build: { status: "CANCELLED" },
    },
    data: { dismissedAt: new Date() },
  });
  if (count === 0) return { error: "This build hasn't been cancelled." };

  revalidatePath("/me");
  return {};
}

export type GroupSizeFormState = FormState<"groupSize">;

// Changes how many spots a group takes on each of its upcoming shifts. It
// has to fit on every one of them. It can drop below the number of people
// who have signed the waiver, since someone may sign and then drop out.
export async function changeGroupSize(
  registrationId: string,
  _prev: GroupSizeFormState,
  formData: FormData,
): Promise<GroupSizeFormState> {
  const user = await getUser();
  if (!user) return { errors: { form: SIGNED_OUT } };

  const parsed = z.coerce
    .number<string>("Enter how many people are in your group.")
    .int("Enter a whole number.")
    .min(2, "A group has at least 2 people. To come alone, sign up again as “Just me”.")
    .max(MAX_GROUP_SIZE, `Groups can have at most ${MAX_GROUP_SIZE} people.`)
    .safeParse(formData.get("groupSize"));
  if (!parsed.success) {
    return { errors: { groupSize: parsed.error.issues[0].message } };
  }
  const size = parsed.data;

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, leaderId: user.id, size: { gt: 1 } },
    select: {
      buildId: true,
      build: { select: { timeZone: true, status: true } },
    },
  });
  if (!registration) return { errors: { form: "We couldn't find that group." } };
  if (registration.build.status === "CANCELLED") {
    return { errors: { form: "Habitat cancelled this build, so the group can't be changed." } };
  }

  let error: string | null;
  try {
    error = await prisma.$transaction(async (tx) => {
      const upcoming = await tx.signup.findMany({
        where: {
          registrationId,
          status: "CONFIRMED",
          shift: { cancelledAt: null, startsAt: { gt: new Date() } },
        },
        select: { shiftId: true },
      });
      if (upcoming.length === 0) {
        return "This group has no upcoming shifts to change.";
      }

      // Lock the shifts so nobody else takes the spots while we check.
      const shiftIds = upcoming.map((s) => s.shiftId);
      await tx.$queryRaw`SELECT id FROM "Shift" WHERE id IN (${Prisma.join(shiftIds)}) FOR UPDATE`;

      const shifts = await tx.shift.findMany({
        where: { id: { in: shiftIds } },
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          endsAt: true,
          capacity: true,
          signups: {
            // Everyone else's spots; this group's own are being replaced.
            where: { status: "CONFIRMED", registrationId: { not: registrationId } },
            select: { registration: { select: { size: true } } },
          },
        },
      });
      for (const shift of shifts) {
        const left = shift.capacity - spotsTaken(shift.signups);
        if (size > left) {
          const zone = registration.build.timeZone;
          return `The ${formatDate(shift.startsAt, zone)}, ${formatTimeRange(shift.startsAt, shift.endsAt, zone)} shift only has room for ${Math.max(left, 0)}.`;
        }
      }

      // Past shifts keep the same registration, so their counts change too.
      await tx.registration.update({
        where: { id: registrationId },
        data: { size },
      });
      return null;
    });
  } catch (e) {
    console.error("Changing group size failed", e);
    return {
      errors: { form: "Something went wrong. Please try again in a moment." },
    };
  }
  if (error) return { errors: { groupSize: error } };

  refresh(registration.buildId);
  return { success: true };
}

export type ProfileFormState = FormState<ProfileField>;

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getUser();
  if (!user) return { errors: { form: SIGNED_OUT } };

  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };

  await prisma.$transaction((tx) => saveProfile(tx, user.id, parsed.data));

  revalidatePath("/me", "layout");
  revalidatePath("/admin", "layout");
  return { success: true };
}
