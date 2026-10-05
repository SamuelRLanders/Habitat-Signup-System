import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
import { prisma } from "@/lib/prisma";
import { addDays, DEFAULT_TIME_ZONE, toDay, zonedDateTime } from "@/lib/time";

// Read queries for volunteers' own signups. Callers pass the email the
// volunteer confirmed (getVerifiedEmail()), never one from a form.

// The volunteer's saved details and their signup for this form, if any,
// formatted for the signup form's fields. Null for someone who has never
// signed up.
export async function getMySignup(formId: string, email: string) {
  const volunteer = await prisma.volunteer.findUnique({
    where: { email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      tShirtSize: true,
      hasDriversLicense: true,
      carSeats: true,
      signups: {
        where: { formId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          tShirtSize: true,
          hasDriversLicense: true,
          transportation: true,
          cancelledAt: true,
          updatedAt: true,
          preferences: { select: { shiftId: true } },
        },
      },
    },
  });
  if (!volunteer) return null;

  const [signup] = volunteer.signups;
  const driver = (await driverStatuses([volunteer.id])).get(volunteer.id)!;
  // What they last told this form, or else what they told the last one.
  const from = signup ?? volunteer;
  return {
    details: {
      firstName: from.firstName,
      lastName: from.lastName,
      phone: from.phone,
      dateOfBirth: toDay(from.dateOfBirth),
      tShirtSize: from.tShirtSize,
      hasDriversLicense: from.hasDriversLicense,
    },
    driver,
    carSeats: volunteer.carSeats,
    signup: signup
      ? {
          id: signup.id,
          cancelledAt: signup.cancelledAt,
          updatedAt: signup.updatedAt,
          shiftIds: signup.preferences.map((p) => p.shiftId),
          transportation: signup.transportation,
        }
      : null,
  };
}

export type MySignup = NonNullable<Awaited<ReturnType<typeof getMySignup>>>;

// Signups that haven't been cancelled. A form takes at most as many as the
// total spots on its shifts.
export function countActiveSignups(formId: string) {
  return prisma.formSignup.count({ where: { formId, cancelledAt: null } });
}

// Volunteers can cancel until the day's first shift starts, even after the
// form closes. With no shifts, until the day ends.
export function cancelDeadline(day: string, shifts: { startsAt: Date }[]) {
  if (shifts.length > 0) {
    return new Date(Math.min(...shifts.map((shift) => shift.startsAt.getTime())));
  }
  return zonedDateTime(addDays(day, 1), "00:00", DEFAULT_TIME_ZONE);
}
