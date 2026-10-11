import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
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
  createdAt: true,
  updatedAt: true,
  assignedShiftId: true,
  volunteer: { select: { id: true, email: true } },
  preferences: { select: { shiftId: true } },
} as const;

// Everyone who has signed up through a form, cancelled or not, by last
// name. shiftIds only has the builds the form still offers; groupEmails are
// the people they asked to be placed with. assignedShiftId is the build an
// admin assigned them to (on a form with custom assignments), if the form
// still offers it. builds is how many builds they'd been on before the
// form's day ("2026-10-24").
export async function getFormRoster(formId: string, day: string, shifts: OfferedShift[]) {
  const offered = new Set(shifts.map((shift) => shift.id));
  const signups = await prisma.formSignup.findMany({
    where: { formId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { ...rosterSelect, groupRequests: { select: { email: true } } },
  });
  const volunteerIds = signups.map((s) => s.volunteer.id);
  const [drivers, builds] = await Promise.all([driverStatuses(volunteerIds), buildsDone(volunteerIds, day)]);
  return signups.map(({ volunteer, preferences, groupRequests, assignedShiftId, ...signup }) => ({
    ...signup,
    assignedShiftId: assignedShiftId && offered.has(assignedShiftId) ? assignedShiftId : null,
    email: volunteer.email,
    driver: drivers.get(volunteer.id)!,
    builds: builds.get(volunteer.id) ?? 0,
    shiftIds: preferences.map((p) => p.shiftId).filter((id) => offered.has(id)),
    groupEmails: groupRequests.map((request) => request.email),
  }));
}

export type RosterSignup = Awaited<ReturnType<typeof getFormRoster>>[number];
