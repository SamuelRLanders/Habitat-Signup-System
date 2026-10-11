import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
import { prisma } from "@/lib/prisma";
import type { OfferedShift } from "@/lib/signup-forms/queries";

// Who signed up through a form and which of its builds they could work at,
// for admin pages. Callers must run requireAdmin() first.

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
// name. shiftIds only has the builds the form still offers; groupEmails are
// the people they asked to be placed with.
export async function getFormRoster(formId: string, shifts: OfferedShift[]) {
  const offered = new Set(shifts.map((shift) => shift.id));
  const signups = await prisma.formSignup.findMany({
    where: { formId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { ...rosterSelect, groupRequests: { select: { email: true } } },
  });
  const drivers = await driverStatuses(signups.map((s) => s.volunteer.id));
  return signups.map(({ volunteer, preferences, groupRequests, ...signup }) => ({
    ...signup,
    email: volunteer.email,
    driver: drivers.get(volunteer.id)!,
    shiftIds: preferences.map((p) => p.shiftId).filter((id) => offered.has(id)),
    groupEmails: groupRequests.map((request) => request.email),
  }));
}

export type RosterSignup = Awaited<ReturnType<typeof getFormRoster>>[number];
