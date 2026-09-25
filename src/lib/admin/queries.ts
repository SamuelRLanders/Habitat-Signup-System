import "server-only";
import { prisma } from "@/lib/prisma";

// Read queries for admin pages that aren't about one build. Callers must run
// requireAdmin() first; these functions don't check who is asking.

// Everyone who has signed in, with their saved details and how many shifts
// they're signed up for (as an individual or a group leader).
export async function listVolunteers() {
  const now = new Date();
  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      profile: { select: { phone: true, smsOptIn: true } },
      _count: {
        select: {
          signups: {
            where: {
              status: "CONFIRMED",
              shift: { cancelledAt: null, startsAt: { gt: now } },
            },
          },
        },
      },
    },
  });

  return users.map(({ _count, ...user }) => ({
    ...user,
    upcomingShifts: _count.signups,
  }));
}
