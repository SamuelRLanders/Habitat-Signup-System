import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// A group's shifts that still take place: confirmed, not cancelled by
// Habitat, and not started yet.
const upcomingSignups = () => ({
  where: {
    status: "CONFIRMED" as const,
    shift: { cancelledAt: null, startsAt: { gt: new Date() } },
  },
  orderBy: { shift: { startsAt: "asc" as const } },
  select: { shift: { select: { startsAt: true, endsAt: true } } },
});

// The group waiver page for a waiver link, or null if the link is wrong.
export const getGroupWaiver = cache(async (token: string) => {
  const registration = await prisma.registration.findUnique({
    where: { waiverToken: token },
    select: {
      groupName: true,
      leader: {
        select: {
          name: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      build: {
        select: { name: true, address: true, timeZone: true, status: true },
      },
      signups: upcomingSignups(),
    },
  });
  if (!registration) return null;

  const { leader, signups, ...rest } = registration;
  return {
    ...rest,
    leaderName: leader.profile
      ? `${leader.profile.firstName} ${leader.profile.lastName}`
      : leader.name,
    shifts: signups.map((s) => s.shift),
    // The link closes once the group has no shifts left to come.
    open: rest.build.status !== "CANCELLED" && signups.length > 0,
  };
});

// A group registration and who has signed its waiver, for its leader.
// Null if it isn't theirs or isn't a group.
export async function getGroupDetail(userId: string, registrationId: string) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, leaderId: userId, size: { gt: 1 } },
    select: {
      id: true,
      size: true,
      groupName: true,
      waiverToken: true,
      build: {
        select: { id: true, name: true, address: true, timeZone: true, status: true },
      },
      signups: upcomingSignups(),
      waiverAcceptances: {
        where: { userId },
        select: { signedName: true, signedAt: true },
      },
      groupMembers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, legalName: true, createdAt: true },
      },
    },
  });
  if (!registration) return null;

  const { signups, waiverAcceptances, ...rest } = registration;
  return {
    ...rest,
    shifts: signups.map((s) => s.shift),
    leaderSignature: waiverAcceptances[0] ?? null,
    open: rest.build.status !== "CANCELLED" && signups.length > 0,
  };
}
