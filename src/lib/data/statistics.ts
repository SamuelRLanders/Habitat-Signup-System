import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TShirtSize, Transportation } from "@/generated/prisma/enums";
import { currentApproval } from "@/lib/drivers/status";
import { EXPERIENCE_LEVELS, experienceOf, type Experience } from "@/lib/experience";
import { buildsDone, pastBuild } from "@/lib/form-signups/experience";
import { prisma } from "@/lib/prisma";
import { today as todayDay } from "@/lib/signup-forms/queries";
import { fromDay, toDay } from "@/lib/time";
import { ageOn, T_SHIRT_SIZES } from "@/lib/volunteers";
import { savePastPlacements } from "./final-placement";
import type { StatsRange } from "./stats-range";

// The Statistics tab: what happened at the events in a time range. Only
// events that are over count, and only published ones (not drafts or
// cancelled events). Attendance isn't taken, so everyone placed at a build
// counts as having gone: each event's placement is saved once its day is
// over (./final-placement.ts). Callers must run requireAdmin() first.

export type TransportKind = "ride" | "ownWay" | "drive" | "notAsked";

export const TRANSPORT_LABELS: Record<TransportKind, string> = {
  ride: "Needed a ride",
  ownWay: "Got there on their own",
  drive: "Offered to drive",
  notAsked: "Not asked",
};

const TRANSPORT_OF: Record<Transportation, TransportKind> = {
  NEEDS_RIDE: "ride",
  OWN_WAY: "ownWay",
  CAN_DRIVE: "drive",
};

export async function getStatistics(range: StatsRange) {
  await savePastPlacements();
  const today = todayDay();

  const date: Prisma.DateTimeFilter = { lt: fromDay(today) };
  if (range.from) date.gte = fromDay(range.from);
  if (range.to) date.lte = fromDay(range.to);

  const forms = await prisma.signupForm.findMany({
    where: { status: "PUBLISHED", date },
    orderBy: [{ date: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      date: true,
      askTransportation: true,
      shifts: { select: { id: true, capacity: true, startsAt: true, endsAt: true, cancelledAt: true } },
      signups: {
        select: {
          volunteerId: true,
          dateOfBirth: true,
          transportation: true,
          cancelledAt: true,
          waitlistedAt: true,
          assignedShiftId: true,
        },
      },
    },
  });

  const ages = new Map<number, number>();
  const months = new Map<string, number>(); // "2026-10" → spots filled
  const transport = new Map<TransportKind, number>();
  const people = new Map<string, { builds: number; hours: number }>();
  let hours = 0;

  const events = forms.map((form) => {
    const day = toDay(form.date);
    const shifts = new Map(form.shifts.map((shift) => [shift.id, shift]));
    const offered = form.shifts.filter((shift) => !shift.cancelledAt);
    let went = 0;
    let notPlaced = 0;
    let waiting = 0;
    let cancelled = 0;

    for (const signup of form.signups) {
      if (signup.cancelledAt) {
        // Cancelling from the waitlist didn't give up a spot.
        if (!signup.waitlistedAt) cancelled++;
        continue;
      }
      if (signup.waitlistedAt) {
        waiting++;
        continue;
      }
      const shift = signup.assignedShiftId ? shifts.get(signup.assignedShiftId) : undefined;
      if (!shift) {
        notPlaced++;
        continue;
      }

      went++;
      const shiftHours = (shift.endsAt.getTime() - shift.startsAt.getTime()) / 3_600_000;
      hours += shiftHours;
      const person = people.get(signup.volunteerId) ?? { builds: 0, hours: 0 };
      people.set(signup.volunteerId, { builds: person.builds + 1, hours: person.hours + shiftHours });

      const age = ageOn(signup.dateOfBirth, day);
      ages.set(age, (ages.get(age) ?? 0) + 1);
      months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1);
      const kind: TransportKind =
        form.askTransportation && signup.transportation ? TRANSPORT_OF[signup.transportation] : "notAsked";
      transport.set(kind, (transport.get(kind) ?? 0) + 1);
    }

    const spots = offered.reduce((sum, shift) => sum + shift.capacity, 0);
    return { id: form.id, name: form.name, day, builds: offered.length, spots, went, notPlaced, waiting, cancelled };
  });

  const ids = [...people.keys()];
  const [volunteers, before, experience, approvedDrivers] = await Promise.all([
    prisma.volunteer.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, tShirtSize: true, buildsAdjustment: true },
    }),
    // Who had been on a build through the app before the range.
    range.from
      ? prisma.formSignup.groupBy({
          by: ["volunteerId"],
          where: { volunteerId: { in: ids }, ...pastBuild(range.from) },
        })
      : Promise.resolve([]),
    buildsDone(ids),
    prisma.volunteer.count({ where: { driverApprovals: { some: currentApproval() } } }),
  ]);

  // Returning: they'd been on a build before the range, through the app or
  // (from an admin's edit of their builds) before it.
  const earlier = new Set(before.map((row) => row.volunteerId));
  const returning = volunteers.filter((v) => earlier.has(v.id) || v.buildsAdjustment > 0).length;

  const sizes = new Map<TShirtSize, number>();
  for (const volunteer of volunteers) sizes.set(volunteer.tShirtSize, (sizes.get(volunteer.tShirtSize) ?? 0) + 1);
  const levels = new Map<Experience, number>();
  for (const id of ids) {
    const level = experienceOf(experience.get(id) ?? 0);
    levels.set(level, (levels.get(level) ?? 0) + 1);
  }

  const names = new Map(volunteers.map((v) => [v.id, `${v.firstName} ${v.lastName}`]));
  const top = [...people]
    .map(([id, person]) => ({ id, name: names.get(id) ?? "", ...person }))
    .sort((a, b) => b.builds - a.builds || b.hours - a.hours || a.name.localeCompare(b.name))
    .slice(0, 10);

  const sum = (key: "went" | "spots" | "builds" | "notPlaced" | "waiting" | "cancelled") =>
    events.reduce((total, event) => total + event[key], 0);

  return {
    events: events.slice().reverse(), // most recent first
    eventCount: events.length,
    buildCount: sum("builds"),
    spots: sum("spots"),
    went: sum("went"),
    notPlaced: sum("notPlaced"),
    waiting: sum("waiting"),
    cancelled: sum("cancelled"),
    people: people.size,
    returning,
    newPeople: people.size - returning,
    hours,
    approvedDrivers,
    ages: fillAges(ages),
    months: fillMonths(months, range, events[0]?.day, events.at(-1)?.day, today),
    transport: (Object.keys(TRANSPORT_LABELS) as TransportKind[])
      .map((kind) => ({ kind, label: TRANSPORT_LABELS[kind], count: transport.get(kind) ?? 0 }))
      .filter((row) => row.kind !== "notAsked" || row.count > 0),
    sizes: T_SHIRT_SIZES.map(({ value, label }) => ({ label, count: sizes.get(value) ?? 0 })),
    experience: EXPERIENCE_LEVELS.map((level) => ({ level, count: levels.get(level) ?? 0 })),
    top,
  };
}

export type Statistics = Awaited<ReturnType<typeof getStatistics>>;

// Every age from the youngest to the oldest, so gaps show as empty columns.
function fillAges(ages: Map<number, number>) {
  if (ages.size === 0) return [];
  const all = [...ages.keys()];
  const rows = [];
  for (let age = Math.min(...all); age <= Math.max(...all); age++) {
    rows.push({ age, count: ages.get(age) ?? 0 });
  }
  return rows;
}

// Every month in the range, or from the first event to the last when the
// range is open-ended, so months without events show as empty.
function fillMonths(
  months: Map<string, number>,
  range: StatsRange,
  firstEvent: string | undefined,
  lastEvent: string | undefined,
  today: string,
) {
  const start = (range.from ?? firstEvent)?.slice(0, 7);
  const lastDay = range.to && range.to < today ? range.to : range.from ? today : lastEvent;
  const end = lastDay?.slice(0, 7);
  if (!start || !end || start > end) return [];
  const rows = [];
  let [year, month] = start.split("-").map(Number);
  // A long custom range is capped, to keep the chart readable.
  for (let i = 0; i < 120; i++) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > end) break;
    rows.push({ month: key, count: months.get(key) ?? 0 });
    month++;
    if (month > 12) [year, month] = [year + 1, 1];
  }
  return rows;
}
