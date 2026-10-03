import * as z from "zod";
import { birthday, phone, required } from "@/lib/profile";
import { MINIMUM_AGE } from "@/lib/volunteers";

// The details a signup form asks for. The email isn't here: it's the one
// the volunteer confirmed with a code.

export const detailsSchema = z.object({
  firstName: required("Enter your first name.", 100),
  lastName: required("Enter your last name.", 100),
  phone: phone("Enter a 10-digit US phone number."),
  dateOfBirth: birthday,
  tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "XXXL"], "Choose a T-shirt size."),
  hasDriversLicense: z
    .enum(["yes", "no"], "Tell us whether you have a driver's license.")
    .transform((value) => value === "yes"),
});

export type DetailsField = keyof z.input<typeof detailsSchema>;
export type SignupField = DetailsField | "shifts";

// Whether someone born on dateOfBirth ("2008-10-11") is old enough on day
// ("2026-10-10"). Dates are compared as YYYY-MM-DD strings, which sort the
// same way as the dates they represent.
export function oldEnoughOn(dateOfBirth: string, day: string) {
  const birthYear = Number(dateOfBirth.slice(0, 4));
  return day >= `${birthYear + MINIMUM_AGE}${dateOfBirth.slice(4)}`;
}

export const TOO_YOUNG = `Volunteers must be ${MINIMUM_AGE} or older on the build day.`;
