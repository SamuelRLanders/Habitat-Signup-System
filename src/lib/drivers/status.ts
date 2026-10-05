import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, fromDay, toDateInput, toDay } from "@/lib/time";
import type { DriverStatus } from "@/lib/volunteers";

// Volunteers' driver approval status. A volunteer is approved while their
// latest approval hasn't passed its end date or been revoked, pending while
// they've said they filled out Purdue's form and no admin has decided, and
// otherwise not approved.

// Today in Indiana. Approvals end at the end of their last day.
export function driverToday() {
  return toDateInput(new Date(), DEFAULT_TIME_ZONE);
}

// The current approval filter: approved, not revoked, not past its end.
export function currentApproval(today = driverToday()) {
  return {
    decision: "APPROVED" as const,
    revokedAt: null,
    approvedUntil: { gte: fromDay(today) },
  };
}

// Each volunteer's status, by volunteer ID.
export async function driverStatuses(volunteerIds: string[]) {
  const volunteers = await prisma.volunteer.findMany({
    where: { id: { in: volunteerIds } },
    select: {
      id: true,
      driverRequestedAt: true,
      driverApprovals: {
        where: currentApproval(),
        orderBy: { approvedUntil: "desc" },
        take: 1,
        select: { approvedUntil: true },
      },
    },
  });
  return new Map<string, DriverStatus>(
    volunteers.map((v) => {
      const [approval] = v.driverApprovals;
      if (approval?.approvedUntil) {
        return [v.id, { status: "approved", until: toDay(approval.approvedUntil) }];
      }
      return [v.id, v.driverRequestedAt ? { status: "pending" } : { status: "none" }];
    }),
  );
}
