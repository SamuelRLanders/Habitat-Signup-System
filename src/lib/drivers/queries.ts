import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, fromDay, toDateInput, DEFAULT_TIME_ZONE } from "@/lib/time";
import { currentApproval, driverToday } from "./status";

// The admin Drivers page. Callers must run requireAdmin() first.

// How long an expired approval stays listed, so admins can follow up.
const RECENTLY_EXPIRED_DAYS = 90;

const volunteerSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  carSeats: true,
} as const;

export async function getDrivers() {
  const today = driverToday();

  const [pending, approvals, expired] = await Promise.all([
    // Waiting for an admin, oldest request first.
    prisma.volunteer.findMany({
      where: { driverRequestedAt: { not: null } },
      orderBy: { driverRequestedAt: "asc" },
      select: { ...volunteerSelect, driverRequestedAt: true },
    }),
    // Current approvals, ending soonest first.
    prisma.driverApproval.findMany({
      where: currentApproval(today),
      orderBy: { approvedUntil: "asc" },
      include: { volunteer: { select: volunteerSelect } },
    }),
    // Approvals that ended recently.
    prisma.driverApproval.findMany({
      where: {
        decision: "APPROVED",
        revokedAt: null,
        approvedUntil: {
          lt: fromDay(today),
          gte: fromDay(addDays(today, -RECENTLY_EXPIRED_DAYS)),
        },
      },
      orderBy: { approvedUntil: "desc" },
      include: { volunteer: { select: volunteerSelect } },
    }),
  ]);

  // A volunteer approved more than once shows only their latest approval,
  // and an expired one only if they aren't approved or pending again.
  const approved = [...new Map(approvals.map((a) => [a.volunteerId, a])).values()];
  const active = new Set([...approved.map((a) => a.volunteerId), ...pending.map((v) => v.id)]);
  const seen = new Set<string>();
  const recentlyExpired = expired.filter((a) => {
    if (active.has(a.volunteerId) || seen.has(a.volunteerId)) return false;
    seen.add(a.volunteerId);
    return true;
  });

  return {
    pending: pending.map((volunteer) => ({
      ...volunteer,
      // The suggested end date: a year after they filled out the form.
      suggestedUntil: addDays(
        toDateInput(volunteer.driverRequestedAt!, DEFAULT_TIME_ZONE),
        365,
      ),
    })),
    approved,
    recentlyExpired,
  };
}
