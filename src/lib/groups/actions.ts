"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { firstErrors, formValues, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { birthday, checkbox, phone, required } from "@/lib/profile";
import { oldEnoughForAll, TOO_YOUNG } from "@/lib/volunteers";
import { fullName } from "./queries";

// Group members joining through their leader's link. They don't sign in:
// knowing the link is what lets them join. Anyone with the link can post
// here, so everything is checked again. There's no limit on how many join,
// since people join and drop out of groups.

const memberSchema = z.object({
  legalName: required("Enter your full name.", 200),
  dateOfBirth: birthday,
  phone: phone("Enter a 10-digit US phone number."),
  smsOptIn: checkbox,
});

export type JoinGroupField = keyof z.input<typeof memberSchema>;

export type JoinGroupState = FormState<JoinGroupField> & {
  name?: string;
};

// "Jane  Q. Smith" and "jane q smith" are the same person.
function sameName(a: string, b: string) {
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalize(a) === normalize(b);
}

export async function joinGroup(
  token: string,
  _prev: JoinGroupState,
  formData: FormData,
): Promise<JoinGroupState> {
  const parsed = memberSchema.safeParse(formValues(formData));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };
  const { legalName, dateOfBirth, phone, smsOptIn } = parsed.data;

  // The transaction returns errors to show, or null once saved.
  let errors: JoinGroupState["errors"] | null;
  try {
    errors = await prisma.$transaction(async (tx) => {
      // Lock the group so two people joining with the same name at once
      // can't both get through the duplicate check.
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Registration" WHERE "joinToken" = ${token} FOR UPDATE`;
      if (!locked) return { form: "This join link isn't valid." };

      const registration = await tx.registration.findUniqueOrThrow({
        where: { id: locked.id },
        select: {
          build: { select: { timeZone: true, status: true } },
          signups: {
            where: {
              status: "CONFIRMED",
              shift: { cancelledAt: null, startsAt: { gt: new Date() } },
            },
            select: { shift: { select: { startsAt: true } } },
          },
          groupMembers: { select: { legalName: true } },
          leader: {
            select: {
              name: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (registration.build.status === "CANCELLED" || registration.signups.length === 0) {
        return { form: "This join link has closed because the group has no upcoming shifts." };
      }
      const shifts = registration.signups.map((s) => s.shift);
      if (!oldEnoughForAll(dateOfBirth, shifts, registration.build.timeZone)) {
        return { dateOfBirth: TOO_YOUNG };
      }
      const names = [
        fullName(registration.leader),
        ...registration.groupMembers.map((m) => m.legalName),
      ];
      if (names.some((name) => sameName(name, legalName))) {
        return { legalName: "Someone with this name has already joined this group." };
      }

      await tx.groupMember.create({
        data: {
          registrationId: locked.id,
          legalName,
          // Stored as a date column; midnight UTC keeps the same calendar day.
          dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
          phone,
          smsOptIn,
          smsOptInAt: smsOptIn ? new Date() : null,
        },
      });
      return null;
    });
  } catch (error) {
    console.error("Joining a group failed", error);
    return {
      errors: { form: "Something went wrong adding you to the group. Please try again in a moment." },
    };
  }
  if (errors) return { errors };

  revalidatePath(`/join/${token}`);
  revalidatePath("/me", "layout");
  revalidatePath("/admin", "layout");
  return { success: true, name: legalName };
}
