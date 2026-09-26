import type { Sex, TShirtSize } from "@/generated/prisma/enums";
import { toDateInput } from "@/lib/time";

// Volunteer rules and choices shared by the signup form and the server.

// For now every volunteer, including each member of a group, must be an
// adult on the day of the shift.
export const MINIMUM_AGE = 18;

export const TOO_YOUNG = `Volunteers must be ${MINIMUM_AGE} or older on the day of their shift.`;

// Whether someone born on dateOfBirth ("1990-05-17") is old enough on the
// day of every shift, in the build's time zone. Dates are compared as
// YYYY-MM-DD strings, which sort the same way as the dates they represent.
export function oldEnoughForAll(
  dateOfBirth: string,
  shifts: { startsAt: Date }[],
  timeZone: string,
) {
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const adultOn = `${birthYear + MINIMUM_AGE}${dateOfBirth.slice(4)}`;
  return shifts.every((shift) => toDateInput(shift.startsAt, timeZone) >= adultOn);
}

// Age in whole years on a day ("2026-09-25"). dateOfBirth is a date-only
// value, so its UTC parts are the birthday.
export function ageOn(dateOfBirth: Date, day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const age = year - dateOfBirth.getUTCFullYear();
  const hadBirthday =
    month > dateOfBirth.getUTCMonth() + 1 ||
    (month === dateOfBirth.getUTCMonth() + 1 && date >= dateOfBirth.getUTCDate());
  return hadBirthday ? age : age - 1;
}

// Largest group one person can sign up. The group also has to fit in the
// open spots of every shift it picks.
export const MAX_GROUP_SIZE = 50;

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
];

export const T_SHIRT_SIZES: { value: TShirtSize; label: string }[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "2XL" },
  { value: "XXXL", label: "3XL" },
];

// "3 spots left", or "Full".
export function spotsText(spotsLeft: number) {
  if (spotsLeft === 0) return "Full";
  return `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`;
}
