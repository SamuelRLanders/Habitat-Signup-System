import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { FormStatus } from "@/generated/prisma/enums";
import { SIGNED_UP, WAITING } from "@/lib/form-signups/status";
import { prisma } from "@/lib/prisma";
import { today as todayDay } from "@/lib/signup-forms/queries";
import { fromDay, toDay } from "@/lib/time";
import { BUILD_PAGE_SIZE, type BuildSearch, type BuildStatus } from "./build-search";
import { placementStored, savePastPlacements } from "./final-placement";

// Read queries for the Data page's Builds tab: every build (one day at one
// address) on any signup form, past or upcoming. Callers must run
// requireAdmin() first.

const BUILD_ORDER: Prisma.ShiftOrderByWithRelationInput[] = [
  { form: { date: "desc" } },
  { startsAt: "asc" },
  { name: "asc" },
];

// One page of the search, with what the table shows. A page past the end
// shows the last page.
export async function searchBuilds(search: BuildSearch) {
  const where = buildsWhere(search, todayDay());
  const total = await prisma.shift.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / BUILD_PAGE_SIZE));
  const page = Math.min(search.page, pageCount);
  const shifts = await prisma.shift.findMany({
    where,
    orderBy: BUILD_ORDER,
    skip: (page - 1) * BUILD_PAGE_SIZE,
    take: BUILD_PAGE_SIZE,
    select: { id: true, name: true, address: true, capacity: true, form: { select: { date: true } } },
  });
  return {
    total,
    page,
    pageCount,
    builds: shifts.map(({ form, ...shift }) => ({ ...shift, day: toDay(form.date) })),
  };
}

// Everything about the builds matching the search, on every page, for the
// CSV download.
export async function exportBuilds(search: BuildSearch) {
  await savePastPlacements();
  const today = todayDay();
  const shifts = await prisma.shift.findMany({
    where: buildsWhere(search, today),
    orderBy: BUILD_ORDER,
    select: { ...detailSelect, _count: { select: { assigned: { where: SIGNED_UP } } } },
  });
  const counts = await preferenceCounts(shifts.map((shift) => shift.id));
  return shifts.map(({ _count, ...shift }) => describe(shift, _count.assigned, counts, today));
}

// One build, with who's going (or went) there, for its popup. Null if
// there's no such build.
export async function getBuildDetails(shiftId: string) {
  await savePastPlacements();
  const today = todayDay();
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: {
      ...detailSelect,
      assigned: {
        where: SIGNED_UP,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { firstName: true, lastName: true, volunteerId: true },
      },
    },
  });
  if (!shift) return null;
  const counts = await preferenceCounts([shift.id]);
  const { assigned, ...rest } = shift;
  const details = describe(rest, assigned.length, counts, today);
  return {
    ...details,
    // Who's assigned there, once that's stored (see placementStored).
    volunteers: details.stored
      ? assigned.map((signup) => ({ id: signup.volunteerId, name: `${signup.firstName} ${signup.lastName}` }))
      : [],
  };
}

export type BuildDetails = NonNullable<Awaited<ReturnType<typeof getBuildDetails>>>;

// How many builds there are, on every form.
export function countBuilds() {
  return prisma.shift.count();
}

// Admins who can be responsible for builds (editors and the owner), and
// anyone else who still is, for the Responsible admin filter.
export async function listBuildAdmins() {
  const users = await prisma.user.findMany({
    where: { OR: [{ role: { in: ["OWNER", "EDITOR"] } }, { buildsOrganized: { some: {} } }] },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
  return users.map((user) => ({ value: user.id, label: user.name || user.email }));
}

const detailSelect = {
  id: true,
  name: true,
  address: true,
  description: true,
  lunch: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  responsible: { select: { name: true, email: true } },
  form: {
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      assignmentsSavedAt: true,
      placementSavedAt: true,
    },
  },
} satisfies Prisma.ShiftSelect;

type DetailShift = Prisma.ShiftGetPayload<{ select: typeof detailSelect }>;

// How many signed-up and waiting volunteers chose each build, by build ID.
async function preferenceCounts(shiftIds: string[]) {
  const count = (signup: Prisma.FormSignupWhereInput) =>
    prisma.shiftPreference.groupBy({
      by: ["shiftId"],
      where: { shiftId: { in: shiftIds }, signup },
      _count: { _all: true },
    });
  const [chose, waiting] = await Promise.all([count(SIGNED_UP), count(WAITING)]);
  const byId = (rows: Awaited<ReturnType<typeof count>>) =>
    new Map(rows.map((row) => [row.shiftId, row._count._all]));
  return { chose: byId(chose), waiting: byId(waiting) };
}

function describe(
  shift: DetailShift,
  assigned: number,
  counts: Awaited<ReturnType<typeof preferenceCounts>>,
  today: string,
) {
  const { form, ...rest } = shift;
  const day = toDay(form.date);
  const status = buildStatus(shift.cancelledAt, form.status, day, today);
  const stored = placementStored(form);
  const hoursEach = (shift.endsAt.getTime() - shift.startsAt.getTime()) / 3_600_000;
  return {
    ...rest,
    day,
    status,
    event: { id: form.id, name: form.name, status: form.status },
    stored,
    // Signed up and assigned there, when that's stored: who went, once the
    // day is over.
    assigned: stored ? assigned : null,
    // Signed-up and waiting volunteers who said they could work there.
    chose: counts.chose.get(shift.id) ?? 0,
    waiting: counts.waiting.get(shift.id) ?? 0,
    // Hours everyone who went there put in, from its times.
    volunteerHours: status === "past" && stored ? assigned * hoursEach : null,
  };
}

export function buildStatus(
  cancelledAt: Date | null,
  formStatus: FormStatus,
  day: string,
  today: string,
): BuildStatus {
  if (cancelledAt || formStatus === "CANCELLED") return "cancelled";
  return day < today ? "past" : "upcoming";
}

function buildsWhere(search: BuildSearch, today: string): Prisma.ShiftWhereInput {
  const and: Prisma.ShiftWhereInput[] = [];
  const has = (value: string) => ({ contains: value, mode: "insensitive" as const });

  // Each word in the build's name or address, or its event's name.
  for (const word of search.q.split(/\s+/).filter(Boolean)) {
    and.push({ OR: [{ name: has(word) }, { address: has(word) }, { form: { name: has(word) } }] });
  }

  const notCancelled: Prisma.ShiftWhereInput = { cancelledAt: null, form: { status: { not: "CANCELLED" } } };
  if (search.status === "cancelled") {
    and.push({ OR: [{ cancelledAt: { not: null } }, { form: { status: "CANCELLED" } }] });
  } else if (search.status === "past") {
    and.push(notCancelled, { form: { date: { lt: fromDay(today) } } });
  } else if (search.status === "upcoming") {
    and.push(notCancelled, { form: { date: { gte: fromDay(today) } } });
  }

  if (search.from) and.push({ form: { date: { gte: fromDay(search.from) } } });
  if (search.to) and.push({ form: { date: { lte: fromDay(search.to) } } });
  if (search.form) and.push({ formId: search.form });
  if (search.admin) and.push({ responsibleId: search.admin });

  return { AND: and };
}
