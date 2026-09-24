import type { Sex, TShirtSize } from "@/generated/prisma/enums";

// Volunteer rules and choices shared by the signup form and the server.

// For now every volunteer, including each member of a group, must be an
// adult on the day of the shift.
export const MINIMUM_AGE = 18;

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
