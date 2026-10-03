import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, DEFAULT_TIME_ZONE, fromDay, toDateInput, toDay } from "@/lib/time";

// Read queries for signup forms. The admin callers must run requireAdmin()
// first; these functions don't check who is asking.

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
// first, each with its shift count and total spots.
export async function listSignupForms(tab: FormListTab) {
  const day = fromDay(today());
  const forms = await prisma.signupForm.findMany({
    where: { date: tab === "upcoming" ? { gte: day } : { lt: day } },
    orderBy: { date: tab === "upcoming" ? "asc" : "desc" },
  });

  const shifts = await offeredShifts(forms.map((form) => toDay(form.date)));
  return forms.map((form) => {
    const formShifts = shifts.get(toDay(form.date)) ?? [];
    return {
      ...form,
      day: toDay(form.date),
      shiftCount: formShifts.length,
      spots: totalSpots(formShifts),
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
    },
  });
  if (!form) return null;

  const day = toDay(form.date);
  const shifts = (await offeredShifts([day])).get(day) ?? [];
  return { ...form, day, shifts };
}

// The forms for some days, by day, for linking to them from a build.
export async function formsOnDays(days: string[]) {
  const forms = await prisma.signupForm.findMany({
    where: { date: { in: days.map(fromDay) } },
    select: { id: true, date: true, status: true },
  });
  return new Map(forms.map((form) => [toDay(form.date), form]));
}
