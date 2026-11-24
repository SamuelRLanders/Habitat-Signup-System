import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/signup-forms/queries";
import { fromDay } from "@/lib/time";

// The admins, for the owner's Admins page, and ownership transfers.

// How long the person being made owner has to accept.
export const TRANSFER_DAYS = 7;

// Every admin: the owner first, then editors, then viewers, each by name,
// with how many upcoming builds they're responsible for.
export async function listAdmins() {
  const admins = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { buildsOrganized: { where: upcomingBuild() } } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  const order = { OWNER: 0, EDITOR: 1, VIEWER: 2 };
  return admins
    .sort((a, b) => order[a.role] - order[b.role])
    .map(({ _count, ...admin }) => ({ ...admin, upcomingBuilds: _count.buildsOrganized }));
}

// A build that's still to come: offered on a form whose event isn't
// cancelled, on a day that hasn't passed. When an admin is removed or made
// a viewer, the owner takes over these.
export function upcomingBuild(): Prisma.ShiftWhereInput {
  return {
    cancelledAt: null,
    form: { status: { not: "CANCELLED" }, date: { gte: fromDay(today()) } },
  };
}

// The admins who can be responsible for a build: the owner and editors,
// by name, for the form editor's dropdown.
export async function listResponsibleAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "EDITOR"] } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return admins.map((admin) => ({ id: admin.id, name: admin.name || admin.email }));
}

// The transfer waiting to be accepted, if there is one that hasn't expired.
export async function getPendingTransfer() {
  return prisma.ownershipTransfer.findFirst({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expiresAt: true,
      to: { select: { id: true, email: true, name: true } },
    },
  });
}

// The transfer a link is for, expired or not, or null if it was cancelled,
// accepted or never existed.
export async function getTransferByToken(token: string) {
  return prisma.ownershipTransfer.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      from: { select: { id: true, email: true, name: true, role: true } },
      to: { select: { id: true, email: true, name: true } },
    },
  });
}

// A transfer link's secret: long and random, so it can't be guessed.
export function newTransferToken() {
  return randomBytes(32).toString("base64url");
}

// Tokens are stored hashed, so a leaked database row can't be used.
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
