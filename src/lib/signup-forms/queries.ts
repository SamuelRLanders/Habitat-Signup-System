import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  DEFAULT_TIME_ZONE,
  formatTimeRange,
  fromDay,
  timeZoneLabel,
  toDateInput,
  toDay,
} from "@/lib/time";

// Read queries for signup forms. The admin callers must run requireAdmin()
// first; these functions don't check who is asking. The public ones only
// return published forms.

const HOUR = 60 * 60 * 1000;

// The shifts each day's form offers: every shift on that day that isn't
// cancelled, at a build that isn't cancelled. A shift's day is the date it
// starts in its build's time zone. Soonest first, by build.
export async function offeredShifts(days: string[]) {
  if (days.length === 0) return new Map<string, OfferedShift[]>();

  // A day starts between 04:00 and 10:00 UTC in US time zones, so these
  // windows hold every shift that could be on it. The exact day is checked
  // below, in each build's zone.
  const shifts = await prisma.shift.findMany({
    where: {
      cancelledAt: null,
      build: { status: "ACTIVE" },
      OR: days.map((day) => ({
        startsAt: {
          gte: fromDay(day),
          lt: new Date(fromDay(addDays(day, 1)).getTime() + 12 * HOUR),
        },
      })),
    },
    orderBy: [{ startsAt: "asc" }, { endsAt: "asc" }],
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      notes: true,
      build: {
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          timeZone: true,
        },
      },
    },
  });

  const byDay = new Map<string, OfferedShift[]>(days.map((day) => [day, []]));
  for (const shift of shifts) {
    byDay.get(toDateInput(shift.startsAt, shift.build.timeZone))?.push(shift);
  }
  return byDay;
}

export type OfferedShift = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  notes: string | null;
  build: {
    id: string;
    name: string;
    address: string;
    description: string | null;
    timeZone: string;
  };
};

// "8:00 AM – 12:00 PM", noting the time zone if it isn't Indiana's.
export function shiftTime(shift: OfferedShift) {
  const zone = shift.build.timeZone;
  const time = formatTimeRange(shift.startsAt, shift.endsAt, zone);
  return zone === DEFAULT_TIME_ZONE ? time : `${time} (${timeZoneLabel(zone)} time)`;
}

// "Maple Street Home, 8:00 AM – 12:00 PM"
export function shiftLabel(shift: OfferedShift) {
  return `${shift.build.name}, ${shiftTime(shift)}`;
}

// The total number of volunteers a form can take: the spots on all its
// shifts.
export function totalSpots(shifts: { capacity: number }[]) {
  return shifts.reduce((sum, shift) => sum + shift.capacity, 0);
}

// Today in Indiana, where forms' dates are.
export function today() {
  return toDateInput(new Date(), DEFAULT_TIME_ZONE);
}

export const FORM_LIST_TABS = ["upcoming", "past"] as const;
export type FormListTab = (typeof FORM_LIST_TABS)[number];

// Forms for today and later, soonest first, or earlier ones, most recent
// first, each with its shift count, total spots and signups.
export async function listSignupForms(tab: FormListTab) {
  const day = fromDay(today());
  const forms = await prisma.signupForm.findMany({
    where: { date: tab === "upcoming" ? { gte: day } : { lt: day } },
    orderBy: { date: tab === "upcoming" ? "asc" : "desc" },
    include: { _count: { select: { signups: { where: { cancelledAt: null } } } } },
  });

  const shifts = await offeredShifts(forms.map((form) => toDay(form.date)));
  return forms.map(({ _count, ...form }) => {
    const formShifts = shifts.get(toDay(form.date)) ?? [];
    return {
      ...form,
      day: toDay(form.date),
      shiftCount: formShifts.length,
      spots: totalSpots(formShifts),
      signupCount: _count.signups,
    };
  });
}

export async function getSignupForm(formId: string) {
  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, body: true },
      },
      _count: { select: { signups: { where: { cancelledAt: null } } } },
    },
  });
  if (!form) return null;

  const { _count, ...rest } = form;
  const day = toDay(form.date);
  const shifts = (await offeredShifts([day])).get(day) ?? [];
  return { ...rest, day, shifts, signupCount: _count.signups };
}

// The forms for some days, by day, for linking to them from a build.
export async function formsOnDays(days: string[]) {
  const forms = await prisma.signupForm.findMany({
    where: { date: { in: days.map(fromDay) } },
    select: { id: true, date: true, status: true },
  });
  return new Map(forms.map((form) => [toDay(form.date), form]));
}

// ─── Public ──────────────────────────────────────────────────────────────────
// Whether a form is open depends on the time, so these wait for a request
// rather than being rendered once at build time.

// Published forms that haven't closed, soonest first, with the builds their
// shifts are at.
export async function listPublicForms() {
  await connection();
  const forms = await prisma.signupForm.findMany({
    where: { status: "PUBLISHED", closesAt: { gt: new Date() } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, status: true, opensAt: true, closesAt: true },
  });

  const shifts = await offeredShifts(forms.map((form) => toDay(form.date)));
  return forms.map((form) => {
    const day = toDay(form.date);
    const builds = new Map((shifts.get(day) ?? []).map((s) => [s.build.id, s.build.name]));
    return { ...form, day, buildNames: [...builds.values()] };
  });
}

// A published form and its shifts, or null for a draft or an unknown ID.
// cache() shares the lookup between the page and its metadata.
export const getPublicForm = cache(async (formId: string) => {
  await connection();
  const form = await prisma.signupForm.findUnique({
    where: { id: formId, status: "PUBLISHED" },
    select: {
      id: true,
      date: true,
      status: true,
      description: true,
      opensAt: true,
      closesAt: true,
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, body: true },
      },
    },
  });
  if (!form) return null;

  const day = toDay(form.date);
  const shifts = (await offeredShifts([day])).get(day) ?? [];
  return { ...form, day, shifts };
});
