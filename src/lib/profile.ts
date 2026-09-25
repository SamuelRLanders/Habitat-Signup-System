import * as z from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeUsPhone } from "@/lib/phone";

// A volunteer's profile details: the rules for the fields in
// src/components/profile-fields.tsx, shared by the signup form and the
// profile page.

export const phone = (message: string) =>
  z.string().transform((value, ctx) => {
    const normalized = normalizeUsPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return normalized;
  });

export const required = (message: string, max: number) =>
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

// A checkbox sends "on" when ticked and nothing otherwise.
export const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const birthday = z.iso
  .date("Enter your birthday.")
  .refine((date) => date >= "1900-01-01", "Enter a valid birthday.")
  .refine(
    (date) => date <= new Date().toISOString().slice(0, 10),
    "Your birthday can't be in the future.",
  );

export const profileSchema = z.object({
  firstName: required("Enter your first name.", 100),
  lastName: required("Enter your last name.", 100),
  phone: phone("Enter a 10-digit US phone number."),
  smsOptIn: checkbox,
  address: required("Enter your home address.", 300),
  emergencyContactName: required("Enter an emergency contact's name.", 200),
  emergencyContactPhone: phone("Enter a 10-digit US phone number."),
  dateOfBirth: birthday,
  sex: optionalChoice(["FEMALE", "MALE"]),
  tShirtSize: optionalChoice(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]),
});

export type ProfileField = keyof z.input<typeof profileSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

// Saves the details as the volunteer's profile and keeps their account name
// in step. Keeps the original consent time if they'd already agreed to texts.
export async function saveProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  profile: ProfileInput,
) {
  const existing = await tx.volunteerProfile.findUnique({
    where: { userId },
    select: { smsOptIn: true, smsOptInAt: true },
  });
  const data = {
    ...profile,
    // Stored as a date column; midnight UTC keeps the same calendar day.
    dateOfBirth: new Date(`${profile.dateOfBirth}T00:00:00Z`),
    smsOptInAt: profile.smsOptIn
      ? existing?.smsOptIn
        ? existing.smsOptInAt
        : new Date()
      : null,
  };
  await tx.volunteerProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  await tx.user.update({
    where: { id: userId },
    data: { name: `${profile.firstName} ${profile.lastName}` },
  });
}
