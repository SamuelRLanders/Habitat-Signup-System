"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { firstErrors, formValues, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { birthday, checkbox, phone, required } from "@/lib/profile";
import { clientIp, clientUserAgent } from "@/lib/request";
import { getActiveWaiver } from "@/lib/signups/queries";
import { oldEnoughForAll, TOO_YOUNG } from "@/lib/volunteers";

// Group members signing the waiver through their leader's link. They don't
// sign in: knowing the link is what lets them sign. Anyone with the link can
// post here, so everything is checked again. There's no limit on how many
// sign, since people join and drop out of groups.

const memberSchema = z.object({
  legalName: required("Type your full legal name to agree to the waiver.", 200),
  dateOfBirth: birthday,
  phone: phone("Enter a 10-digit US phone number."),
  smsOptIn: checkbox,
  waiverId: z.string("Refresh the page and try again.").min(1),
});

export type MemberWaiverField = keyof z.input<typeof memberSchema>;

export type MemberWaiverState = FormState<MemberWaiverField> & {
  signedName?: string;
};

// "Jane  Q. Smith" and "jane q smith" are the same person.
function sameName(a: string, b: string) {
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalize(a) === normalize(b);
}

export async function signGroupWaiver(
  token: string,
  _prev: MemberWaiverState,
  formData: FormData,
): Promise<MemberWaiverState> {
  const parsed = memberSchema.safeParse(formValues(formData));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };
  const { legalName, dateOfBirth, phone, smsOptIn, waiverId } = parsed.data;

  const waiver = await getActiveWaiver();
  if (!waiver || waiver.id !== waiverId) {
    return {
      errors: {
        legalName:
          "The waiver was updated while you were filling this in. Refresh the page to read the new version.",
      },
    };
  }

  const ipAddress = await clientIp();
  const userAgent = await clientUserAgent();

  // The transaction returns errors to show, or null once saved.
  let errors: MemberWaiverState["errors"] | null;
  try {
    errors = await prisma.$transaction(async (tx) => {
      // Lock the group so two people signing the same name at once can't
      // both get through the duplicate check.
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Registration" WHERE "waiverToken" = ${token} FOR UPDATE`;
      if (!locked) return { form: "This waiver link isn't valid." };

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
          waiverAcceptances: {
            where: { userId: { not: null } },
            select: { signedName: true },
          },
        },
      });

      if (registration.build.status === "CANCELLED" || registration.signups.length === 0) {
        return { form: "This waiver link has closed because the group has no upcoming shifts." };
      }
      const shifts = registration.signups.map((s) => s.shift);
      if (!oldEnoughForAll(dateOfBirth, shifts, registration.build.timeZone)) {
        return { dateOfBirth: TOO_YOUNG };
      }
      const names = [
        ...registration.groupMembers.map((m) => m.legalName),
        ...registration.waiverAcceptances.map((w) => w.signedName),
      ];
      if (names.some((name) => sameName(name, legalName))) {
        return { legalName: "Someone with this name has already signed for this group." };
      }

      const member = await tx.groupMember.create({
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
      await tx.waiverAcceptance.create({
        data: {
          signedName: legalName,
          ipAddress,
          userAgent,
          waiverId: waiver.id,
          registrationId: locked.id,
          groupMemberId: member.id,
        },
      });
      return null;
    });
  } catch (error) {
    console.error("Group waiver signing failed", error);
    return {
      errors: { form: "Something went wrong saving your signature. Please try again in a moment." },
    };
  }
  if (errors) return { errors };

  revalidatePath(`/waiver/${token}`);
  revalidatePath("/me", "layout");
  revalidatePath("/admin", "layout");
  return { success: true, signedName: legalName };
}
