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

// Purdue's driver approval form. Volunteers who'll drive for us must be
// approved through it; admins then record the approval on the Drivers page.
export const DRIVER_APPROVAL_URL =
  "https://enroll.sambasafety.com/index.html?Z3VpZD1iNzE0MGNjYmQwYjM0NGExYTU4ODE4MzU4OTQzZGNjOSZmbG93LWlkPWRkMGE5Mjg2LTE5YTUtNDE0My1hOGFkLWZhNDM4MjNlOGM2MiZ0ZW5hbnQtaWQ9ZmNiYWZlNTItMDYyNi00MDQ3LWE4YTMtN2RmYTZjYWU3MTVj";

export const TRANSPORTATION_OPTIONS = [
  { value: "NEEDS_RIDE", label: "I need a ride to the site" },
  { value: "OWN_WAY", label: "I can get to the site on my own" },
  { value: "CAN_DRIVE", label: "I have a car and am willing to help drive other volunteers" },
] as const;

// Seats a driver's car can have, counting the driver's. A car needs room
// for at least 2 passengers to count toward driving others.
export const MIN_CAR_SEATS = 3;
export const MAX_CAR_SEATS = 15;

// Volunteers can ask to be placed with up to this many friends on a day,
// by their Purdue email, when the day has more than one build.
export const MAX_GROUP_REQUESTS = 5;

// Volunteers sign in, and name friends, with their Purdue email. Outside
// production the test data's @example.org addresses work too
// (scripts/seed-test-data.mts). Takes a lowercased email.
export const PURDUE_EMAIL_DOMAIN = "@purdue.edu";
const TEST_EMAIL_DOMAIN = "@example.org";
export function isVolunteerEmail(email: string) {
  return (
    email.endsWith(PURDUE_EMAIL_DOMAIN) ||
    (process.env.NODE_ENV !== "production" && email.endsWith(TEST_EMAIL_DOMAIN))
  );
}

// "Needs a ride", for admin lists.
export const TRANSPORTATION_SHORT = {
  NEEDS_RIDE: "Needs a ride",
  OWN_WAY: "Own way",
  CAN_DRIVE: "Can drive",
} as const;

// A volunteer's driver approval: none, pending since they said they filled
// out the form, or approved through a day ("2027-10-05").
export type DriverStatus =
  | { status: "none" }
  | { status: "pending" }
  | { status: "approved"; until: string };

// "4 seats", or "No car" for 0 (only on signups from before cars needed at
// least MIN_CAR_SEATS).
export function seatsLabel(seats: number) {
  if (seats === 0) return "No car";
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}
