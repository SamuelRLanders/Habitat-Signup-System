import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toDateInput } from "@/lib/time";

// Public data for a build's signup page. Only published and closed builds
// are public; drafts and cancelled builds return null, so their links show
// "not found".
export const getSignupBuild = cache(async (buildId: string) => {
  const build = await prisma.build.findUnique({
    where: { id: buildId, status: { in: ["PUBLISHED", "CLOSED"] } },
    select: {
      id: true,
      name: true,
      address: true,
      description: true,
      timeZone: true,
      status: true,
      shifts: {
        // Shifts volunteers can still sign up for.
        where: { cancelledAt: null, startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          notes: true,
          signups: {
            where: { status: "CONFIRMED" },
            select: { registration: { select: { size: true } } },
          },
        },
      },
    },
  });
  if (!build) return null;

  return {
    ...build,
    shifts: build.shifts.map(({ signups, ...shift }) => ({
      ...shift,
      spotsLeft: Math.max(0, shift.capacity - spotsTaken(signups)),
    })),
  };
});

// Spots used by a shift's confirmed signups: each takes its registration's size.
export function spotsTaken(signups: { registration: { size: number } }[]) {
  return signups.reduce((sum, s) => sum + s.registration.size, 0);
}

// The waiver volunteers sign now, or null if an admin hasn't added one.
export const getActiveWaiver = cache(() =>
  prisma.waiver.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
    select: { id: true, title: true, body: true },
  }),
);

// The signed-in volunteer's saved details, formatted for the signup form's
// fields, or null if they haven't signed up before.
export async function getProfileDefaults(userId: string) {
  const profile = await prisma.volunteerProfile.findUnique({
    where: { userId },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      smsOptIn: true,
      address: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      dateOfBirth: true,
      sex: true,
      tShirtSize: true,
    },
  });
  if (!profile) return null;
  return {
    ...profile,
    // Stored as midnight UTC; the UTC calendar day is the birthday.
    dateOfBirth: toDateInput(profile.dateOfBirth, "UTC"),
  };
}
