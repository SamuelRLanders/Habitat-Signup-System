import type { NextRequest } from "next/server";
import { parsePeopleSearch } from "@/lib/admin/people-search";
import { exportPeople } from "@/lib/admin/queries";
import { getUser } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { DEFAULT_TIME_ZONE, toDateInput } from "@/lib/time";

// Downloads everyone matching the People page's current search (every page
// of it) as a CSV. Columns use the User and VolunteerProfile tables' names,
// leaving out IDs. The profile's timestamps are prefixed so they don't
// clash with the user's.
const HEADER = [
  "email",
  "name",
  "emailVerified",
  "role",
  "createdAt",
  "updatedAt",
  "firstName",
  "lastName",
  "phone",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "dateOfBirth",
  "sex",
  "tShirtSize",
  "smsOptIn",
  "smsOptInAt",
  "profileCreatedAt",
  "profileUpdatedAt",
];

export async function GET(request: NextRequest) {
  // Answer with a status rather than requireAdmin()'s redirect, since this
  // is a file download, not a page.
  const user = await getUser();
  if (!user) return new Response("Sign in to download this file.", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Admins only.", { status: 403 });

  const people = await exportPeople(parsePeopleSearch(request.nextUrl.searchParams));
  const rows = people.map(({ profile, ...user }) => [
    user.email,
    user.name,
    user.emailVerified,
    user.role,
    user.createdAt,
    user.updatedAt,
    profile?.firstName,
    profile?.lastName,
    profile?.phone,
    profile?.address,
    profile?.emergencyContactName,
    profile?.emergencyContactPhone,
    // A date-only column: "1992-04-11".
    profile?.dateOfBirth.toISOString().slice(0, 10),
    profile?.sex,
    profile?.tShirtSize,
    profile?.smsOptIn,
    profile?.smsOptInAt,
    profile?.createdAt,
    profile?.updatedAt,
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
