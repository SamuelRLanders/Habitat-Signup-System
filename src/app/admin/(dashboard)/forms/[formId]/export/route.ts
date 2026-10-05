import type { NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { getFormRoster } from "@/lib/form-signups/rosters";
import { getSignupForm, shiftLabel } from "@/lib/signup-forms/queries";
import { toDay } from "@/lib/time";
import { ageOn } from "@/lib/volunteers";

// Downloads everyone who signed up through a form, cancelled or not, as a
// CSV for placing volunteers on shifts: their details from this signup,
// then a column per shift the form offers, marked "yes" if they could work
// it.
const HEADER = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "dateOfBirth",
  "ageOnBuildDay",
  "tShirtSize",
  "hasDriversLicense",
  "driverStatus",
  "driverApprovedUntil",
  "transportation",
  "carSeats",
  "status",
  "signedUpAt",
  "updatedAt",
  "cancelledAt",
];

export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/admin/forms/[formId]/export">,
) {
  // Answer with a status rather than requireAdmin()'s redirect, since this
  // is a file download, not a page.
  if (!(await getAdmin())) {
    return new Response("Sign in as an admin to download this file.", { status: 401 });
  }

  const { formId } = await params;
  const form = await getSignupForm(formId);
  if (!form) return new Response("This form no longer exists.", { status: 404 });

  const roster = await getFormRoster(form.id, form.shifts);
  const rows = roster.map((signup) => [
    signup.email,
    signup.firstName,
    signup.lastName,
    signup.phone,
    toDay(signup.dateOfBirth),
    ageOn(signup.dateOfBirth, form.day),
    signup.tShirtSize,
    signup.hasDriversLicense,
    signup.driver.status === "none" ? "not approved" : signup.driver.status,
    signup.driver.status === "approved" ? signup.driver.until : "",
    signup.transportation,
    signup.carSeats,
    signup.cancelledAt ? "cancelled" : "signed up",
    signup.createdAt,
    signup.updatedAt,
    signup.cancelledAt,
    ...form.shifts.map((shift) => (signup.shiftIds.includes(shift.id) ? "yes" : "")),
  ]);

  return new Response(toCsv([...HEADER, ...form.shifts.map(shiftLabel)], rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="signups-${form.day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
