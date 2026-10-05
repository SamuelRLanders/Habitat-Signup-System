import * as z from "zod";
import { normalizeUsPhone } from "@/lib/phone";
import { MINIMUM_AGE } from "@/lib/volunteers";

// The details a signup form asks for. The email isn't here: it's the one
// the volunteer confirmed with a code.

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

const birthday = z.iso
  .date("Enter your birthday.")
  .refine((date) => date >= "1900-01-01", "Enter a valid birthday.")
  .refine(
    (date) => date <= new Date().toISOString().slice(0, 10),
    "Your birthday can't be in the future.",
  );

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
// The other questions: the builds, the driver approval form (only for
// volunteers with a license who aren't approved or pending), how they're
// getting there, and their car's seats (only if they'll drive others).
export type SignupField = DetailsField | "shifts" | "driverForm" | "transportation" | "carSeats";

export const transportationSchema = z.enum(
  ["NEEDS_RIDE", "OWN_WAY", "CAN_DRIVE"],
  "Tell us how you're getting to the build site.",
);

export const driverFormSchema = z.enum(
  ["done", "not-done"],
  "Tell us whether you've filled out the driver approval form.",
);

export const MAX_CAR_SEATS = 15;

// Seats in their car, counting the driver's; 0 means no car.
export const carSeatsSchema = z
  .string("Tell us how many seats your car has.")
  .regex(/^\d{1,2}$/, "Tell us how many seats your car has.")
  .transform(Number)
  .refine((seats) => seats <= MAX_CAR_SEATS, `Enter at most ${MAX_CAR_SEATS} seats.`);

// Whether someone born on dateOfBirth ("2008-10-11") is old enough on day
// ("2026-10-10"). Dates are compared as YYYY-MM-DD strings, which sort the
// same way as the dates they represent.
export function oldEnoughOn(dateOfBirth: string, day: string) {
  const birthYear = Number(dateOfBirth.slice(0, 4));
  return day >= `${birthYear + MINIMUM_AGE}${dateOfBirth.slice(4)}`;
}

export const TOO_YOUNG = `Volunteers must be ${MINIMUM_AGE} or older on the build day.`;
