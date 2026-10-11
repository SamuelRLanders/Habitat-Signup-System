import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, fromDay, toDateInput } from "@/lib/time";

// How many builds each volunteer has done, for how experienced they are
// (src/lib/experience.ts): their signups through the app for earlier event
// days, plus any adjustment an admin made by editing the number
// (Volunteer.buildsAdjustment). Attendance isn't taken, so a signup counts
// unless it was cancelled, its event was cancelled, or admins saved custom
// assignments that didn't place them at a build. Callers must run
// requireAdmin() first.

// A signup for an event day before this one that they went to, as far as
// the app knows.
function pastBuild(before: string): Prisma.FormSignupWhereInput {
  return {
    cancelledAt: null,
    form: { status: "PUBLISHED", date: { lt: fromDay(before) } },
    OR: [{ form: { assignmentsSavedAt: null } }, { assignedShiftId: { not: null } }],
  };
}

// Builds counted from each volunteer's signups before a day, and admins'
// adjustments, by volunteer ID.
export async function countBuilds(volunteerIds: string[], before: string) {
  const [volunteers, past] = await Promise.all([
    prisma.volunteer.findMany({
      where: { id: { in: volunteerIds } },
      select: { id: true, buildsAdjustment: true },
    }),
    prisma.formSignup.groupBy({
      by: ["volunteerId"],
      where: { volunteerId: { in: volunteerIds }, ...pastBuild(before) },
      _count: { _all: true },
    }),
  ]);
  const counted = new Map(past.map(({ volunteerId, _count }) => [volunteerId, _count._all]));
  return new Map(
    volunteers.map((volunteer) => [
      volunteer.id,
      { counted: counted.get(volunteer.id) ?? 0, adjustment: volunteer.buildsAdjustment },
    ]),
  );
}

// Builds each volunteer had done before a day ("2026-10-24"; today if left
// out), by volunteer ID. For an event, that's before its day, so its own
// signups never count toward its placement, even after it's over. Never
// less than 0, even if a signup an admin's adjustment made up for is later
// cancelled.
export async function buildsDone(volunteerIds: string[], before?: string): Promise<Map<string, number>> {
  if (volunteerIds.length === 0) return new Map();
  const builds = await countBuilds(volunteerIds, before ?? toDateInput(new Date(), DEFAULT_TIME_ZONE));
  return new Map(
    [...builds].map(([id, { counted, adjustment }]) => [id, Math.max(0, counted + adjustment)]),
  );
}
