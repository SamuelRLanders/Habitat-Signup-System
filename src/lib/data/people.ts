import "server-only";
import { driverStatuses } from "@/lib/drivers/status";
import { buildsDone } from "@/lib/form-signups/experience";
import { prisma } from "@/lib/prisma";
import { today as todayDay } from "@/lib/signup-forms/queries";
import { toDay } from "@/lib/time";
import { placementStored, saveStartedPlacements } from "./final-placement";

// One volunteer's details and every event they signed up for, for their
// popup on the Data page's People tab. Null if there's no such volunteer.
// Callers must run requireAdmin() first.
export async function getPersonDetails(volunteerId: string) {
  await saveStartedPlacements();
  const today = todayDay();
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      tShirtSize: true,
      hasDriversLicense: true,
      carSeats: true,
      createdAt: true,
      updatedAt: true,
      signups: {
        orderBy: { form: { date: "desc" } },
        select: {
          id: true,
          cancelledAt: true,
          waitlistedAt: true,
          noShow: true,
          addedAt: true,
          assignedShift: { select: { name: true } },
          plannedShift: { select: { name: true } },
          preferences: { select: { shift: { select: { name: true, cancelledAt: true } } } },
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
        },
      },
    },
  });
  if (!volunteer) return null;

  const [drivers, builds] = await Promise.all([driverStatuses([volunteer.id]), buildsDone([volunteer.id])]);
  const { signups, ...details } = volunteer;

  return {
    ...details,
    driver: drivers.get(volunteer.id) ?? { status: "none" as const },
    builds: builds.get(volunteer.id) ?? 0,
    // Events they didn't come to, and didn't cancel, as admins confirmed.
    noShows: signups.filter((signup) => signup.noShow && signup.form.status === "PUBLISHED").length,
    signups: signups.map((signup) => {
      const day = toDay(signup.form.date);
      const past = day < today;
      const stored = placementStored(signup.form);
      const build = stored ? (signup.assignedShift?.name ?? null) : null;
      const status: string =
        signup.form.status === "CANCELLED"
          ? "Event cancelled"
          : stored && signup.noShow
            ? "No-show"
            : signup.cancelledAt
              ? "Cancelled"
              : signup.waitlistedAt
                ? past
                  ? "Was on the waitlist"
                  : "On the waitlist"
                : build
                  ? past
                    ? "Went"
                    : "Assigned"
                  : stored
                    ? "Not placed"
                    : "Signed up";
      return {
        id: signup.id,
        formId: signup.form.id,
        event: signup.form.name,
        day,
        past,
        status,
        // Where they went or are going, or the build a no-show missed.
        build:
          status === "Went" || status === "Assigned"
            ? build
            : status === "No-show"
              ? (signup.plannedShift?.name ?? null)
              : null,
        // An admin added them on the day, without a signup.
        added: signup.addedAt !== null,
        // The builds they said they could work at, while where they're
        // going isn't decided yet.
        chose:
          status === "Signed up" || status === "On the waitlist"
            ? signup.preferences.filter((p) => !p.shift.cancelledAt).map((p) => p.shift.name)
            : [],
      };
    }),
  };
}

export type PersonDetails = NonNullable<Awaited<ReturnType<typeof getPersonDetails>>>;

// How many people have signed up through a signup form.
export function countPeople() {
  return prisma.volunteer.count();
}
