import type { TShirtSize } from "@/generated/prisma/enums";

// Volunteer rules and choices shared by the signup form and admin pages.

// Every volunteer must be an adult on the build day.
export const MINIMUM_AGE = 18;

export const T_SHIRT_SIZES: { value: TShirtSize; label: string }[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "2XL" },
  { value: "XXXL", label: "3XL" },
];

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

// "M", or "2XL" for XXL.
export function shirtLabel(size: TShirtSize) {
  return T_SHIRT_SIZES.find((option) => option.value === size)?.label ?? size;
}
