import type { NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { parseBuildSearch } from "@/lib/data/build-search";
import { exportBuilds } from "@/lib/data/builds";
import { DEFAULT_TIME_ZONE, toDateInput, toTimeInput } from "@/lib/time";

// Downloads every build matching the Data page Builds tab's current search
// (every page of it), or every build before a search, as a CSV, most recent
// day first. Columns use the Shift table's names where there's one, leaving
// out IDs; times are in Indiana time.
const HEADER = [
  "date",
  "startTime",
  "endTime",
  "name",
  "address",
  "capacity", // spots
  "status", // upcoming, past or cancelled (the build or its whole event)
  "event", // its signup form's name
  "eventStatus",
  "responsibleAdmin",
  "responsibleEmail",
  // Signed up and placed there, once that's saved (custom assignments, or
  // once the first build starts): who went, from the confirmed assignments,
  // for a past build. Empty until then.
  "volunteers",
  "noShows", // planned to go there, but didn't come or cancel
  "chose", // signed-up volunteers who said they could work there
  "waitlisted", // waiting volunteers who chose it
  "volunteerHours", // past builds: volunteers × its length in hours
  "lunch",
  "description",
  "cancelledAt",
  "createdAt",
  "updatedAt",
];

export async function GET(request: NextRequest) {
  // Answer with a status rather than requireAdmin()'s redirect, since this
  // is a file download, not a page.
  if (!(await getAdmin())) {
    return new Response("Sign in as an admin to download this file.", { status: 401 });
  }

  const builds = await exportBuilds(parseBuildSearch(request.nextUrl.searchParams));
  const rows = builds.map((build) => [
    build.day,
    toTimeInput(build.startsAt, DEFAULT_TIME_ZONE),
    toTimeInput(build.endsAt, DEFAULT_TIME_ZONE),
    build.name,
    build.address,
    build.capacity,
    build.status,
    build.event.name,
    build.event.status.toLowerCase(),
    build.responsible?.name ?? "",
    build.responsible?.email ?? "",
    build.assigned,
    build.noShows,
    build.chose,
    build.waiting,
    build.volunteerHours === null ? null : Math.round(build.volunteerHours * 100) / 100,
    build.lunch,
    build.description,
    build.cancelledAt,
    build.createdAt,
    build.updatedAt,
  ]);

  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);
  return new Response(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="builds-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
