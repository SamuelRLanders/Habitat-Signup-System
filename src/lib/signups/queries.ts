import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Public data for a build's signup page. Only published and closed builds
// are public; drafts and cancelled builds return null, so their links show
// "not found".
export const getSignupBuild = cache(async (buildId: string) => {
  const build = await prisma.build.findUnique({
    where: { id: buildId, status: { in: ["PUBLISHED", "CLOSED"] } },
    select: {
      id: true,
      name: true,
      address: true,
      description: true,
      timeZone: true,
      status: true,
      shifts: {
        // Shifts volunteers can still sign up for.
        where: { cancelledAt: null, startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          notes: true,
          signups: {
            where: { status: "CONFIRMED" },
            select: { groupSize: true },
          },
        },
      },
    },
  });
  if (!build) return null;

  return {
    ...build,
    shifts: build.shifts.map(({ signups, ...shift }) => ({
      ...shift,
      spotsLeft: Math.max(
        0,
        shift.capacity - signups.reduce((sum, s) => sum + s.groupSize, 0),
      ),
    })),
  };
});
