import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type PeopleSearch } from "@/lib/admin/people-search";
import { prisma } from "@/lib/prisma";
import { addDays, DEFAULT_TIME_ZONE, formatDay, fromDay, toDateInput, toDay, zonedDateTime } from "@/lib/time";

// Read queries for admin pages that aren't about one build or form. Callers
// must run requireAdmin() first; these functions don't check who is asking.

// One page of the People search: every volunteer who has signed up through a
// form and matches, with their latest details and how many upcoming build
// days they're signed up for. A page past the end shows the last page.
export async function searchPeople(search: PeopleSearch) {
  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);
  const where = peopleWhere(search, today);
  const total = await prisma.volunteer.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(search.page, pageCount);

  const volunteers = await prisma.volunteer.findMany({
    where,
    orderBy: PEOPLE_ORDER,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      tShirtSize: true,
      hasDriversLicense: true,
      createdAt: true,
      _count: { select: { signups: { where: upcomingSignup(today) } } },
    },
  });

  return {
    total,
    page,
    pageCount,
    people: volunteers.map(({ _count, ...volunteer }) => ({
      ...volunteer,
      upcomingSignups: _count.signups,
    })),
  };
}

// Everyone matching the search, on every page, with the Volunteer table's
// columns for the CSV download.
export async function exportPeople(search: PeopleSearch) {
  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);
  return prisma.volunteer.findMany({
    where: peopleWhere(search, today),
    orderBy: PEOPLE_ORDER,
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      tShirtSize: true,
      hasDriversLicense: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Every signup form, newest day first, for the "Signed up for" filter.
export async function listFormChoices() {
  const forms = await prisma.signupForm.findMany({
    orderBy: { date: "desc" },
    select: { id: true, date: true },
  });
  return forms.map((form) => ({ value: form.id, label: formatDay(toDay(form.date), "short") }));
}

const PEOPLE_ORDER: Prisma.VolunteerOrderByWithRelationInput[] = [
  { lastName: "asc" },
  { firstName: "asc" },
  { email: "asc" },
];

// A signup that isn't cancelled, for a build day that hasn't passed.
function upcomingSignup(today: string): Prisma.FormSignupWhereInput {
  return { cancelledAt: null, form: { date: { gte: fromDay(today) } } };
}

function peopleWhere(search: PeopleSearch, today: string): Prisma.VolunteerWhereInput {
  const and: Prisma.VolunteerWhereInput[] = [];

  const text = textWhere(search);
  if (text) and.push(text);

  if (search.size.length > 0) and.push({ tShirtSize: { in: search.size } });

  // Ages are counted today. At least N means born on or before this day N
  // years ago; at most N means born after this day N + 1 years ago.
  if (search.ageMin !== null || search.ageMax !== null) {
    const dateOfBirth: Prisma.DateTimeFilter = {};
    if (search.ageMin !== null) dateOfBirth.lte = yearsBefore(today, search.ageMin);
    if (search.ageMax !== null) dateOfBirth.gt = yearsBefore(today, search.ageMax + 1);
    and.push({ dateOfBirth });
  }

  if (search.license) and.push({ hasDriversLicense: search.license === "yes" });

  if (search.upcoming === "yes") and.push({ signups: { some: upcomingSignup(today) } });
  if (search.upcoming === "no") and.push({ signups: { none: upcomingSignup(today) } });

  if (search.form) {
    and.push({ signups: { some: { formId: search.form, cancelledAt: null } } });
  }

  // When they first signed up: whole days in the admin time zone, both ends
  // included.
  if (search.joinedFrom || search.joinedTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (search.joinedFrom) {
      createdAt.gte = zonedDateTime(search.joinedFrom, "00:00", DEFAULT_TIME_ZONE);
    }
    if (search.joinedTo) {
      createdAt.lt = zonedDateTime(addDays(search.joinedTo, 1), "00:00", DEFAULT_TIME_ZONE);
    }
    and.push({ createdAt });
  }

  return { AND: and };
}

// The search box. Matching ignores case and finds the text anywhere in the
// field. "Any field" matches each word separately, so "nguyen alice" finds
// Alice Nguyen. Phone searches compare digits only, so "(765) 555" matches
// +17655550123.
function textWhere({ by, q }: PeopleSearch): Prisma.VolunteerWhereInput | null {
  if (!q) return null;
  const has = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const phoneHas = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? { phone: { contains: digits } } : null;
  };

  switch (by) {
    case "firstName":
      return { firstName: has(q) };
    case "lastName":
      return { lastName: has(q) };
    case "email":
      return { email: has(q) };
    case "phone":
      // No digits can't match any phone number.
      return phoneHas(q) ?? { id: { in: [] } };
    case "any":
      return {
        AND: q.split(/\s+/).map((word) => {
          const phone = phoneHas(word);
          return {
            OR: [
              { firstName: has(word) },
              { lastName: has(word) },
              { email: has(word) },
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
