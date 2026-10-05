import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
import { prisma } from "@/lib/prisma";
import type { OfferedShift } from "@/lib/signup-forms/queries";
import { fromDay, toDateInput, toDay } from "@/lib/time";

// Who could work which shifts, for admin pages. Callers must run
// requireAdmin() first. A volunteer is willing to work a shift if their
// signup isn't cancelled, they chose the shift, and the shift is still on
// the day of the form they signed up through (a shift moved to another day
// leaves its old form).

const rosterSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  dateOfBirth: true,
  tShirtSize: true,
  hasDriversLicense: true,
  transportation: true,
  carSeats: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  volunteer: { select: { id: true, email: true } },
  preferences: { select: { shiftId: true } },
} as const;

// Everyone who has signed up through a form, cancelled or not, by last
// name. shiftIds only has the shifts the form still offers.
export async function getFormRoster(formId: string, shifts: OfferedShift[]) {
  const offered = new Set(shifts.map((shift) => shift.id));
  const signups = await prisma.formSignup.findMany({
    where: { formId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: rosterSelect,
  });
  const drivers = await driverStatuses(signups.map((s) => s.volunteer.id));
  return signups.map(({ volunteer, preferences, ...signup }) => ({
    ...signup,
    email: volunteer.email,
    driver: drivers.get(volunteer.id)!,
    shiftIds: preferences.map((p) => p.shiftId).filter((id) => offered.has(id)),
  }));
}

export type RosterSignup = Awaited<ReturnType<typeof getFormRoster>>[number];

// The volunteers willing to work one shift, by last name, with the other
// shifts that day they'd also work.
export async function getShiftVolunteers(shift: {
  id: string;
  startsAt: Date;
  build: { timeZone: string };
}) {
  const day = toDateInput(shift.startsAt, shift.build.timeZone);
  const signups = await prisma.formSignup.findMany({
    where: {
      cancelledAt: null,
      form: { date: fromDay(day) },
      preferences: { some: { shiftId: shift.id } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: rosterSelect,
  });
  const drivers = await driverStatuses(signups.map((s) => s.volunteer.id));
  return signups.map(({ volunteer, preferences, ...signup }) => ({
    ...signup,
    email: volunteer.email,
    driver: drivers.get(volunteer.id)!,
    otherShiftIds: preferences.map((p) => p.shiftId).filter((id) => id !== shift.id),
  }));
}

// For each shift, the signups willing to work it. Shifts nobody chose are
// left out.
export async function willingByShift(shiftIds: string[]) {
  const preferences = await prisma.shiftPreference.findMany({
    where: { shiftId: { in: shiftIds }, signup: { cancelledAt: null } },
    select: {
      shiftId: true,
      signupId: true,
      shift: { select: { startsAt: true, build: { select: { timeZone: true } } } },
      signup: { select: { form: { select: { date: true } } } },
    },
  });

  const willing = new Map<string, string[]>();
  for (const { shiftId, signupId, shift, signup } of preferences) {
    if (toDateInput(shift.startsAt, shift.build.timeZone) !== toDay(signup.form.date)) continue;
    willing.set(shiftId, [...(willing.get(shiftId) ?? []), signupId]);
  }
  return willing;
}
