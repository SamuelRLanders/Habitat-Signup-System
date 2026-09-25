import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { spotsTaken } from "@/lib/signups/queries";

// Read queries for the admin build pages. Callers must run requireAdmin()
// first; these functions don't check who is asking.

export const BUILD_LIST_TABS = ["upcoming", "drafts", "past"] as const;
export type BuildListTab = (typeof BUILD_LIST_TABS)[number];

// Only confirmed signups take up spots. Each takes its registration's size.
const confirmedSpots = {
  where: { status: "CONFIRMED" },
  select: { registration: { select: { size: true } } },
} satisfies Prisma.Shift$signupsArgs;

export async function listBuilds(tab: BuildListTab) {
  const now = new Date();
  const hasUpcomingShift: Prisma.BuildWhereInput = {
    shifts: { some: { cancelledAt: null, endsAt: { gte: now } } },
  };

  // The tabs split builds with no overlap: drafts; live builds with a shift
  // still to come; everything else (finished or cancelled).
  const where: Prisma.BuildWhereInput =
    tab === "drafts"
      ? { status: "DRAFT" }
      : tab === "upcoming"
        ? { status: { in: ["PUBLISHED", "CLOSED"] }, ...hasUpcomingShift }
        : {
            status: { not: "DRAFT" },
            OR: [{ status: "CANCELLED" }, { NOT: hasUpcomingShift }],
          };

  const builds = await prisma.build.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      shifts: {
        where: { cancelledAt: null },
        orderBy: { startsAt: "asc" },
        select: {
          startsAt: true,
          endsAt: true,
          capacity: true,
          signups: confirmedSpots,
        },
      },
    },
  });

  const summaries = builds.map(({ shifts, ...build }) => ({
    ...build,
    shiftCount: shifts.length,
    firstShiftAt: shifts.at(0)?.startsAt ?? null,
    lastShiftAt: shifts.at(-1)?.endsAt ?? null,
    capacity: shifts.reduce((total, shift) => total + shift.capacity, 0),
    filled: shifts.reduce((total, s) => total + spotsTaken(s.signups), 0),
  }));

  // Soonest first for upcoming builds, most recent first for past ones.
  // Drafts keep the newest-created-first order.
  if (tab === "upcoming") {
    summaries.sort((a, b) => time(a.firstShiftAt) - time(b.firstShiftAt));
  } else if (tab === "past") {
    summaries.sort((a, b) => time(b.lastShiftAt) - time(a.lastShiftAt));
  }
  return summaries;
}

function time(date: Date | null) {
  return date?.getTime() ?? 0;
}

export async function getBuild(buildId: string) {
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: {
      shifts: {
        orderBy: { startsAt: "asc" },
        include: {
          signups: confirmedSpots,
          _count: { select: { signups: true } },
        },
      },
    },
  });
  if (!build) return null;

  return {
    ...build,
    shifts: build.shifts.map(({ signups, _count, ...shift }) => ({
      ...shift,
      filled: spotsTaken(signups),
      // Includes cancelled signups. Shifts with any signups are cancelled
      // rather than deleted, so their history is kept.
      signupCount: _count.signups,
    })),
  };
}

// A shift's volunteers: each signup's leader (or individual) with their
// contact details, and for groups, the members who have signed the waiver
// through the group's link.
export async function getShiftRoster(buildId: string, shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId, buildId },
    include: {
      build: true,
      signups: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              name: true,
              profile: { select: { phone: true, smsOptIn: true } },
            },
          },
          registration: {
            select: {
              size: true,
              groupName: true,
              groupMembers: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  legalName: true,
                  phone: true,
                  smsOptIn: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!shift) return null;

  const confirmed = shift.signups.filter((s) => s.status === "CONFIRMED");
  return {
    ...shift,
    filled: spotsTaken(confirmed),
    confirmed,
    other: shift.signups.filter((s) => s.status !== "CONFIRMED"),
  };
}
