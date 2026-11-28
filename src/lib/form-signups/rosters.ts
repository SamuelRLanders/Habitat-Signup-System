import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
import { reservedAt } from "@/lib/placement/load";
import { prisma } from "@/lib/prisma";
import { buildsDone } from "./experience";
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
  waitlistedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedShiftId: true,
  plannedShiftId: true,
  noShow: true,
  addedAt: true,
  addedByName: true,
  volunteer: { select: { id: true, email: true } },
  preferences: { select: { shiftId: true } },
  reservation: { select: { shiftId: true } },
} as const;

// Everyone who has signed up through a form, cancelled or not, by last
// name. shiftIds only has the builds the form still offers; groupEmails are
// the people they asked to be placed with. assignedShiftId is the build an
// admin assigned them to (on a form with custom assignments), or where they
// went (once the first build has started), if the form still offers it;
// plannedShiftId, noShow and addedAt are for the confirmed assignments
// (see FormSignup). reservedShiftId is the build of the reserved spot they
// signed up with, if the form still offers it. builds is how many builds
// they'd been on before the form's day ("2026-10-24"). driver is their
// status today, or on the form's day with driversOnDay (for saving the
// placement once the day has started, which may be days later).
export async function getFormRoster(
  formId: string,
  day: string,
  shifts: OfferedShift[],
  { driversOnDay = false } = {},
) {
  const offered = new Set(shifts.map((shift) => shift.id));
  const signups = await prisma.formSignup.findMany({
    where: { formId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { ...rosterSelect, groupRequests: { select: { email: true } } },
  });
  const volunteerIds = signups.map((s) => s.volunteer.id);
  const [drivers, builds] = await Promise.all([
    driversOnDay ? driverStatuses(volunteerIds, day) : driverStatuses(volunteerIds),
    buildsDone(volunteerIds, day),
  ]);
  return signups.map(({ volunteer, preferences, groupRequests, assignedShiftId, reservation, ...signup }) => ({
    ...signup,
    reservedShiftId: reservedAt(reservation, offered),
    assignedShiftId: assignedShiftId && offered.has(assignedShiftId) ? assignedShiftId : null,
    email: volunteer.email,
    driver: drivers.get(volunteer.id)!,
    builds: builds.get(volunteer.id) ?? 0,
    shiftIds: preferences.map((p) => p.shiftId).filter((id) => offered.has(id)),
    groupEmails: groupRequests.map((request) => request.email),
  }));
}

export type RosterSignup = Awaited<ReturnType<typeof getFormRoster>>[number];
