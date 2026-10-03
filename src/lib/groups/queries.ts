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

const leaderName = {
  select: {
    name: true,
    profile: { select: { firstName: true, lastName: true } },
  },
};

// The leader's name from their profile, or their account name if they
// somehow have no profile.
export function fullName(leader: {
  name: string;
  profile: { firstName: string; lastName: string } | null;
}) {
  return leader.profile
    ? `${leader.profile.firstName} ${leader.profile.lastName}`
    : leader.name;
}

// The join page for a group's link, or null if the link is wrong.
export const getGroupInvite = cache(async (token: string) => {
  const registration = await prisma.registration.findUnique({
    where: { joinToken: token },
    select: {
      groupName: true,
      leader: leaderName,
      build: {
        select: {
          name: true,
          address: true,
          timeZone: true,
          status: true,
          sections: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, body: true },
          },
        },
      },
      signups: upcomingSignups(),
    },
  });
  if (!registration) return null;

  const { leader, signups, ...rest } = registration;
  return {
    ...rest,
    leaderName: fullName(leader),
    shifts: signups.map((s) => s.shift),
    // The link closes once the group has no shifts left to come.
    open: rest.build.status !== "CANCELLED" && signups.length > 0,
  };
});

// A group registration and who has joined it, for its leader. Null if it
// isn't theirs or isn't a group.
export async function getGroupDetail(userId: string, registrationId: string) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, leaderId: userId, size: { gt: 1 } },
    select: {
      id: true,
      size: true,
      groupName: true,
      joinToken: true,
      createdAt: true,
      leader: leaderName,
      build: {
        select: { id: true, name: true, address: true, timeZone: true, status: true },
      },
      signups: upcomingSignups(),
      groupMembers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, legalName: true, createdAt: true },
      },
    },
  });
  if (!registration) return null;

  const { signups, leader, ...rest } = registration;
  return {
    ...rest,
    leaderName: fullName(leader),
    shifts: signups.map((s) => s.shift),
    open: rest.build.status !== "CANCELLED" && signups.length > 0,
  };
}
