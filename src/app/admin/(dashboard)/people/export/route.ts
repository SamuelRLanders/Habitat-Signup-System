import type { NextRequest } from "next/server";
import { parsePeopleSearch } from "@/lib/admin/people-search";
import { exportPeople } from "@/lib/admin/queries";
import { getAdmin } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { DEFAULT_TIME_ZONE, toDateInput, toDay } from "@/lib/time";

// Downloads every volunteer matching the People page's current search
// (every page of it) as a CSV. Columns use the Volunteer table's names,
// leaving out IDs. Details are each volunteer's latest; createdAt is when
// they first signed up.
const HEADER = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "dateOfBirth",
  "tShirtSize",
  "hasDriversLicense",
  "createdAt",
  "updatedAt",
];

export async function GET(request: NextRequest) {
  // Answer with a status rather than requireAdmin()'s redirect, since this
  // is a file download, not a page.
  if (!(await getAdmin())) {
    return new Response("Sign in as an admin to download this file.", { status: 401 });
  }

  const people = await exportPeople(parsePeopleSearch(request.nextUrl.searchParams));
  const rows = people.map((person) => [
    person.email,
    person.firstName,
    person.lastName,
    person.phone,
    // A date-only column: "1992-04-11".
    toDay(person.dateOfBirth),
    person.tShirtSize,
    person.hasDriversLicense,
    person.createdAt,
    person.updatedAt,
  ]);

  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);
  return new Response(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="people-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
