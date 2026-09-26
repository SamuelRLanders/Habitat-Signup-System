import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type PeopleSearch } from "@/lib/admin/people-search";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, toDateInput, zonedDateTime } from "@/lib/time";

// Read queries for admin pages that aren't about one build. Callers must run
// requireAdmin() first; these functions don't check who is asking.

// One page of the People search: everyone who has signed in and matches,
// with their saved details and how many shifts they're signed up for (as an
// individual or a group leader). A page past the end shows the last page.
export async function searchPeople(search: PeopleSearch) {
  const now = new Date();
  const where = peopleWhere(search, now);
  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(search.page, pageCount);

  const users = await prisma.user.findMany({
    where,
    orderBy: PEOPLE_ORDER,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          phone: true,
          smsOptIn: true,
          dateOfBirth: true,
          sex: true,
          tShirtSize: true,
        },
      },
      _count: { select: { signups: { where: upcomingSignup(now) } } },
    },
  });

  return {
    total,
    page,
    pageCount,
    people: users.map(({ _count, ...user }) => ({
      ...user,
      upcomingShifts: _count.signups,
    })),
  };
}

// Everyone matching the search, on every page, with the columns of the User
// and VolunteerProfile tables the CSV download includes.
export async function exportPeople(search: PeopleSearch) {
  return prisma.user.findMany({
    where: peopleWhere(search, new Date()),
    orderBy: PEOPLE_ORDER,
    select: {
      email: true,
      name: true,
      emailVerified: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          dateOfBirth: true,
          sex: true,
          tShirtSize: true,
          smsOptIn: true,
          smsOptInAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

// By last name, then first name. People with no saved details sort last,
// by email.
const PEOPLE_ORDER: Prisma.UserOrderByWithRelationInput[] = [
  { profile: { lastName: "asc" } },
  { profile: { firstName: "asc" } },
  { email: "asc" },
];

// A confirmed signup for a shift that hasn't started or been cancelled.
function upcomingSignup(now: Date): Prisma.SignupWhereInput {
  return { status: "CONFIRMED", shift: { cancelledAt: null, startsAt: { gt: now } } };
}

function peopleWhere(search: PeopleSearch, now: Date): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const hasProfile = (profile: Prisma.VolunteerProfileWhereInput) => ({ profile: { is: profile } });
  const noProfile = { profile: { is: null } };

  const text = textWhere(search);
  if (text) and.push(text);

  // "none" also matches people with no saved details.
  if (search.sex.length > 0) {
    const chosen = search.sex.filter((sex) => sex !== "none");
    and.push({
      OR: [
        hasProfile({ sex: { in: chosen } }),
        ...(search.sex.includes("none") ? [hasProfile({ sex: null }), noProfile] : []),
      ],
    });
  }
  if (search.size.length > 0) {
    const chosen = search.size.filter((size) => size !== "none");
    and.push({
      OR: [
        hasProfile({ tShirtSize: { in: chosen } }),
        ...(search.size.includes("none") ? [hasProfile({ tShirtSize: null }), noProfile] : []),
      ],
    });
  }

  // Ages are counted in the admin time zone, today. At least N means born
  // on or before this day N years ago; at most N means born after this day
  // N + 1 years ago.
  if (search.ageMin !== null || search.ageMax !== null) {
    const today = toDateInput(now, DEFAULT_TIME_ZONE);
    const dateOfBirth: Prisma.DateTimeFilter = {};
    if (search.ageMin !== null) dateOfBirth.lte = yearsBefore(today, search.ageMin);
    if (search.ageMax !== null) dateOfBirth.gt = yearsBefore(today, search.ageMax + 1);
    and.push(hasProfile({ dateOfBirth }));
  }

  if (search.role) and.push({ role: search.role });

  if (search.details === "yes") and.push({ profile: { isNot: null } });
  if (search.details === "no") and.push(noProfile);

  if (search.texts === "yes") and.push(hasProfile({ smsOptIn: true }));
  if (search.texts === "no") and.push({ NOT: hasProfile({ smsOptIn: true }) });

  if (search.shifts === "yes") and.push({ signups: { some: upcomingSignup(now) } });
  if (search.shifts === "no") and.push({ signups: { none: upcomingSignup(now) } });

  // Whole days in the admin time zone, both ends included.
  if (search.joinedFrom || search.joinedTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (search.joinedFrom) {
      createdAt.gte = zonedDateTime(search.joinedFrom, "00:00", DEFAULT_TIME_ZONE);
    }
    if (search.joinedTo) {
      createdAt.lt = zonedDateTime(nextDay(search.joinedTo), "00:00", DEFAULT_TIME_ZONE);
    }
    and.push({ createdAt });
  }

  return { AND: and };
}

// The search box. Matching ignores case and finds the text anywhere in the
// field. "Any field" matches each word separately, so "nguyen alice" finds
// Alice Nguyen. Phone searches compare digits only, so "(765) 555" matches
// +17655550123.
function textWhere({ by, q }: PeopleSearch): Prisma.UserWhereInput | null {
  if (!q) return null;
  const has = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const phoneHas = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? { profile: { is: { phone: { contains: digits } } } } : null;
  };

  switch (by) {
    case "firstName":
      return { profile: { is: { firstName: has(q) } } };
    case "lastName":
      return { profile: { is: { lastName: has(q) } } };
    case "email":
      return { email: has(q) };
    case "address":
      return { profile: { is: { address: has(q) } } };
    case "phone":
      // No digits can't match any phone number.
      return phoneHas(q) ?? { id: { in: [] } };
    case "any":
      return {
        AND: q.split(/\s+/).map((word) => {
          const phone = phoneHas(word);
          return {
            OR: [
              { name: has(word) },
              { email: has(word) },
              { profile: { is: { firstName: has(word) } } },
              { profile: { is: { lastName: has(word) } } },
              ...(phone ? [phone] : []),
            ],
          };
        }),
      };
  }
}

// "2026-09-25", 18 → Sep 25, 2008, as a date-only value. Feb 29 becomes
// Feb 28 in years without one.
function yearsBefore(day: string, years: number) {
  const [year, month, date] = day.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year - years, month, 0)).getUTCDate();
  return new Date(Date.UTC(year - years, month - 1, Math.min(date, daysInMonth)));
}

// "2026-09-25" → "2026-09-26"
function nextDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}
