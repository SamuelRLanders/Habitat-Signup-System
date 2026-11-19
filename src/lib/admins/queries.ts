import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// The admins, for the owner's Admins page, and ownership transfers.

// How long the person being made owner has to accept.
export const TRANSFER_DAYS = 7;

// Every admin: the owner first, then editors, then viewers, each by name.
export async function listAdmins() {
  const admins = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  const order = { OWNER: 0, EDITOR: 1, VIEWER: 2 };
  return admins.sort((a, b) => order[a.role] - order[b.role]);
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
