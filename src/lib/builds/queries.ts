import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getShiftVolunteers, willingByShift } from "@/lib/form-signups/rosters";
import { prisma } from "@/lib/prisma";
import { formsOnDays, offeredShifts } from "@/lib/signup-forms/queries";
import { toDateInput } from "@/lib/time";

// Read queries for the admin build pages. Callers must run requireAdmin()
// first; these functions don't check who is asking.

export const BUILD_LIST_TABS = ["upcoming", "past"] as const;
export type BuildListTab = (typeof BUILD_LIST_TABS)[number];

export async function listBuilds(tab: BuildListTab) {
  const now = new Date();

  // The tabs split builds with no overlap. Upcoming: active builds with a
  // shift still to come, or no shifts yet. Past: everything else (finished
  // or cancelled).
  const upcoming: Prisma.BuildWhereInput = {
    status: "ACTIVE",
    OR: [
      { shifts: { some: { cancelledAt: null, endsAt: { gte: now } } } },
      { shifts: { none: { cancelledAt: null } } },
    ],
  };
  const where = tab === "upcoming" ? upcoming : { NOT: upcoming };

  const builds = await prisma.build.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      shifts: {
        where: { cancelledAt: null },
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, endsAt: true, capacity: true },
      },
    },
  });

  const willing = await willingByShift(builds.flatMap((b) => b.shifts.map((s) => s.id)));
  const summaries = builds.map(({ shifts, ...build }) => ({
    ...build,
    shiftCount: shifts.length,
    firstShiftAt: shifts.at(0)?.startsAt ?? null,
    lastShiftAt: shifts.at(-1)?.endsAt ?? null,
    capacity: shifts.reduce((total, shift) => total + shift.capacity, 0),
    // Volunteers willing to work any of the build's shifts, each counted once.
    willing: new Set(shifts.flatMap((shift) => willing.get(shift.id) ?? [])).size,
  }));

  // Soonest first for upcoming builds, with new builds that have no shifts
  // yet at the top. Most recent first for past ones.
  if (tab === "upcoming") {
    summaries.sort((a, b) => time(a.firstShiftAt) - time(b.firstShiftAt));
  } else {
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
        include: { _count: { select: { preferences: true } } },
      },
    },
  });
  if (!build) return null;

  const willing = await willingByShift(build.shifts.map((shift) => shift.id));
  return {
    ...build,
    shifts: build.shifts.map(({ _count, ...shift }) => ({
      ...shift,
      willing: willing.get(shift.id)?.length ?? 0,
      // Everyone who ever chose the shift, including cancelled signups.
      // Shifts with any are cancelled rather than deleted, so the record is
      // kept.
      chosenCount: _count.preferences,
    })),
  };
}

// A shift with the volunteers willing to work it, the other shifts that day
// (to show what else each volunteer would work), and the day's form.
export async function getShiftRoster(buildId: string, shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId, buildId },
    include: { build: true },
  });
  if (!shift) return null;

  const day = toDateInput(shift.startsAt, shift.build.timeZone);
  const [volunteers, dayShifts, forms] = await Promise.all([
    getShiftVolunteers(shift),
    offeredShifts([day]),
    formsOnDays([day]),
  ]);
  return {
    ...shift,
    day,
    volunteers,
    dayShifts: dayShifts.get(day) ?? [],
    form: forms.get(day) ?? null,
  };
}
