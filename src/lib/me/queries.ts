import "server-only";
import { prisma } from "@/lib/prisma";

// Data for a volunteer's own pages. Every query is scoped to the user ID
// passed in, which callers take from the session.

// The volunteer's registrations (as an individual or a group leader), split
// into upcoming shifts and past ones.
export async function getMySignups(userId: string) {
  const registrations = await prisma.registration.findMany({
    where: { leaderId: userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      size: true,
      groupName: true,
      waiverToken: true,
      dismissedAt: true,
      build: {
        select: { id: true, name: true, address: true, timeZone: true, status: true },
      },
      signups: {
        // Shifts the volunteer cancelled aren't shown.
        where: { status: "CONFIRMED" },
        orderBy: { shift: { startsAt: "asc" } },
        select: {
          id: true,
          status: true,
          shift: {
            select: {
              startsAt: true,
              endsAt: true,
              cancelledAt: true,
              notes: true,
            },
          },
        },
      },
      _count: { select: { groupMembers: true } },
    },
  });

  const now = new Date();
  const isUpcoming = (s: { shift: { startsAt: Date } }) => s.shift.startsAt > now;
  // Signups that still take place: not cancelled by Habitat.
  const isOn = (s: { shift: { cancelledAt: Date | null } }) => !s.shift.cancelledAt;

  const upcoming = registrations
    .map(({ signups, _count, dismissedAt, ...registration }) => {
      const shifts = signups.filter(isUpcoming);
      const buildCancelled = registration.build.status === "CANCELLED";
      return {
        ...registration,
        shifts,
        buildCancelled,
        // Dismissing only hides the card while the build stays cancelled.
        hidden: buildCancelled && dismissedAt !== null,
        // The leader signed when they signed up; members sign through the link.
        waiversSigned: 1 + _count.groupMembers,
        // Whether there's anything left to change or cancel.
        active: !buildCancelled && shifts.some(isOn),
      };
    })
    .filter((registration) => registration.shifts.length > 0 && !registration.hidden)
    .sort(
      (a, b) =>
        a.shifts[0].shift.startsAt.getTime() - b.shifts[0].shift.startsAt.getTime(),
    );

  // Shifts of cancelled builds never happened, so they aren't past shifts.
  const past = registrations
    .filter(({ build }) => build.status !== "CANCELLED")
    .flatMap(({ build, size, groupName, signups }) =>
      signups
        .filter((s) => !isUpcoming(s) && isOn(s))
        .map((signup) => ({ ...signup, build, size, groupName })),
    )
    .sort((a, b) => b.shift.startsAt.getTime() - a.shift.startsAt.getTime());

  return { upcoming, past };
}

// Published builds with shifts still to come, soonest first.
export async function getOpenBuilds() {
  const now = new Date();
  const builds = await prisma.build.findMany({
    where: {
      status: "PUBLISHED",
      shifts: { some: { cancelledAt: null, startsAt: { gt: now } } },
    },
    select: {
      id: true,
      name: true,
      address: true,
      timeZone: true,
      shifts: {
        where: { cancelledAt: null, startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  return builds
    .map(({ shifts, ...build }) => ({
      ...build,
      firstStart: shifts[0].startsAt,
      lastEnd: shifts.at(-1)!.endsAt,
      shiftCount: shifts.length,
    }))
    .sort((a, b) => a.firstStart.getTime() - b.firstStart.getTime());
}

// Whether the volunteer has saved their details yet.
export async function hasProfile(userId: string) {
  const count = await prisma.volunteerProfile.count({ where: { userId } });
  return count > 0;
}
