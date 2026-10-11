import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TIME_ZONE,
  formatTimeRange,
  fromDay,
  toDateInput,
  toDay,
} from "@/lib/time";

// Read queries for signup forms. The admin callers must run requireAdmin()
// first; these functions don't check who is asking. The public ones only
// return published forms.

// The builds a form offers, for including with it: the ones that aren't
// cancelled, soonest first.
export const offeredShifts = {
  where: { cancelledAt: null },
  orderBy: [{ startsAt: "asc" }, { endsAt: "asc" }, { name: "asc" }],
  select: {
    id: true,
    name: true,
    address: true,
    description: true,
    lunch: true,
    startsAt: true,
    endsAt: true,
    capacity: true,
  },
} satisfies Prisma.SignupForm$shiftsArgs;

export type OfferedShift = Prisma.ShiftGetPayload<{ select: typeof offeredShifts.select }>;

// "8:00 AM – 12:00 PM", in Indiana time.
export function shiftTime(shift: { startsAt: Date; endsAt: Date }) {
  return formatTimeRange(shift.startsAt, shift.endsAt, DEFAULT_TIME_ZONE);
}

// "Maple Street Home, 8:00 AM – 12:00 PM"
export function shiftLabel(shift: OfferedShift) {
  return `${shift.name}, ${shiftTime(shift)}`;
}

// The total number of volunteers a form can take: the spots at all its
// builds.
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
// first (forms on the same day by name), each with its build count, total
// spots and signups.
export async function listSignupForms(tab: FormListTab) {
  const day = fromDay(today());
  const forms = await prisma.signupForm.findMany({
    where: { date: tab === "upcoming" ? { gte: day } : { lt: day } },
    orderBy: [{ date: tab === "upcoming" ? "asc" : "desc" }, { name: "asc" }],
    include: {
      shifts: { where: offeredShifts.where, select: { capacity: true } },
      _count: { select: { signups: { where: { cancelledAt: null } } } },
    },
  });

  return forms.map(({ _count, shifts, ...form }) => ({
    ...form,
    day: toDay(form.date),
    shiftCount: shifts.length,
    spots: totalSpots(shifts),
    signupCount: _count.signups,
  }));
}

// A form with the builds it offers, and the cancelled ones (which admins
// can restore), soonest first.
export async function getSignupForm(formId: string) {
  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    include: {
      shifts: { orderBy: offeredShifts.orderBy, select: { ...offeredShifts.select, cancelledAt: true } },
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, body: true },
      },
      _count: { select: { signups: { where: { cancelledAt: null } } } },
    },
  });
  if (!form) return null;

  const { _count, shifts, ...rest } = form;
  return {
    ...rest,
    day: toDay(form.date),
    shifts: shifts.filter((shift) => !shift.cancelledAt),
    cancelledShifts: shifts.filter((shift) => shift.cancelledAt),
    signupCount: _count.signups,
  };
}

// ─── Public ──────────────────────────────────────────────────────────────────
// Whether a form is open depends on the time, so these wait for a request
// rather than being rendered once at build time.

// Published forms listed on the home page that haven't closed, soonest
// first, with the names of their builds.
export async function listPublicForms() {
  await connection();
  const forms = await prisma.signupForm.findMany({
    where: { status: "PUBLISHED", listed: true, closesAt: { gt: new Date() } },
    orderBy: [{ date: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      opensAt: true,
      closesAt: true,
      shifts: { where: offeredShifts.where, orderBy: offeredShifts.orderBy, select: { name: true } },
    },
  });

  return forms.map(({ shifts, ...form }) => ({
    ...form,
    day: toDay(form.date),
    buildNames: [...new Set(shifts.map((shift) => shift.name))],
  }));
}

// A published or cancelled form and its builds, or null for a draft or an
// unknown ID. cache() shares the lookup between the page and its metadata.
export const getPublicForm = cache(async (formId: string) => {
  await connection();
  const form = await prisma.signupForm.findUnique({
    where: { id: formId, status: { in: ["PUBLISHED", "CANCELLED"] } },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      description: true,
      opensAt: true,
      closesAt: true,
      askTransportation: true,
      askGroups: true,
      shifts: offeredShifts,
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, body: true },
      },
    },
  });
  if (!form) return null;
  return { ...form, day: toDay(form.date) };
});
