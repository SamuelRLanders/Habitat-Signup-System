"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireAdmin, requireOwner } from "@/lib/auth/dal";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/auth/roles";
import { firstErrors, type ActionState, type FormState } from "@/lib/forms";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAdminAdded, sendTransferDone, sendTransferLink } from "./emails";
import { hashToken, newTransferToken, TRANSFER_DAYS, upcomingBuild } from "./queries";

// The owner managing the admins on the Admins page, and an admin accepting
// ownership from a transfer link. Every owner action calls requireOwner()
// first, and treats the IDs it's sent as untrusted. The owner can't be
// removed or have their role changed here: ownership only changes hands by
// a transfer the new owner accepts.

function revalidateAdmins() {
  revalidatePath("/admin", "layout");
}

// ─── Adding, changing and removing admins ────────────────────────────────────

const roleSchema = z.enum(ASSIGNABLE_ROLES, "Choose editor or viewer.");

const addAdminSchema = z.object({
  name: z.string("Enter their name.").trim().min(1, "Enter their name.").max(100, "Keep the name under 100 characters."),
  email: z.string("Enter their email address.").pipe(
    z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  ),
  role: roleSchema,
});

export type AddAdminState = FormState<"name" | "email" | "role"> & {
  // Set when they were added, but the email to them didn't send.
  warning?: string;
};

// Adds an admin and emails them that they can sign in. The dialog warns
// the owner about the email first.
export async function addAdmin(_prev: AddAdminState, formData: FormData): Promise<AddAdminState> {
  const owner = await requireOwner();

  const parsed = addAdminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { errors: firstErrors(parsed.error) };
  const { name, email, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    return { errors: { email: `${email} is already ${existing.role === "OWNER" ? "the owner" : "an admin"}.` } };
  }

  try {
    await prisma.user.create({ data: { email, name, role } });
  } catch (error) {
    // Most likely added by someone else at the same moment.
    console.error("Failed to add admin", error);
    return { errors: { form: "We couldn't add them. Check they aren't already an admin, then try again." } };
  }
  revalidateAdmins();

  try {
    await sendAdminAdded({ to: { email, name }, role, owner });
  } catch (error) {
    console.error("Failed to email new admin", error);
    return {
      success: true,
      warning: `${name} was added, but the email to them didn't send. Let them know they can sign in at the admin sign-in page with ${email}.`,
    };
  }
  return { success: true };
}

// Makes an admin an editor or a viewer. A viewer can't organize builds, so
// the owner takes over their upcoming ones.
export async function setAdminRole(userId: string, role: AssignableRole): Promise<ActionState> {
  const owner = await requireOwner();
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { error: "Choose editor or viewer." };

  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, role: { not: "OWNER" } },
      data: { role: parsed.data },
    });
    if (count > 0 && parsed.data === "VIEWER") await handBuildsToOwner(tx, userId, owner.id);
    return count;
  });
  if (count === 0) return { error: "This admin no longer exists, or is now the owner." };

  revalidateAdmins();
  return {};
}

// Removes an admin. They're signed out everywhere at once, since their
// sessions are deleted with them. The forms they created and the driver
// decisions they made are kept, with their name. The owner takes over the
// upcoming builds they were responsible for.
export async function removeAdmin(userId: string): Promise<ActionState> {
  const owner = await requireOwner();

  const { count } = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: userId, role: { not: "OWNER" } },
      select: { id: true },
    });
    if (target) await handBuildsToOwner(tx, userId, owner.id);
    return tx.user.deleteMany({ where: { id: userId, role: { not: "OWNER" } } });
  });
  if (count === 0) return { error: "This admin was already removed, or is now the owner." };

  revalidateAdmins();
  return {};
}

// Makes the owner responsible for the upcoming builds an admin was
// responsible for. Past builds keep theirs as a record (or lose it, if
// they're removed).
async function handBuildsToOwner(tx: Prisma.TransactionClient, userId: string, ownerId: string) {
  await tx.shift.updateMany({
    where: { responsibleId: userId, ...upcomingBuild() },
    data: { responsibleId: ownerId },
  });
}

// ─── Transferring ownership ──────────────────────────────────────────────────

// Starts handing the site over to another admin: emails them a link to
// accept. The owner stays the owner until they do, and can cancel it.
// Starting a new transfer replaces any earlier one. The dialog warns the
// owner about the email first.
export async function startTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner();

  const toId = formData.get("toId");
  if (typeof toId !== "string" || !toId) return { error: "Choose who to make the owner." };
  const to = await prisma.user.findUnique({
    where: { id: toId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!to || to.role === "OWNER") return { error: "Choose another admin. They may have been removed." };

  const token = newTransferToken();
  const expiresAt = new Date(Date.now() + TRANSFER_DAYS * 24 * 60 * 60 * 1000);
  const [, transfer] = await prisma.$transaction([
    prisma.ownershipTransfer.deleteMany({}),
    prisma.ownershipTransfer.create({
      data: { tokenHash: hashToken(token), expiresAt, fromId: owner.id, toId: to.id },
      select: { id: true },
    }),
  ]);

  try {
    await sendTransferLink({ to, owner, token, expiresAt });
  } catch (error) {
    console.error("Failed to email ownership transfer link", error);
    // Without the email nobody has the link, so don't leave it waiting.
    await prisma.ownershipTransfer.deleteMany({ where: { id: transfer.id } });
    revalidateAdmins();
    return { error: "We couldn't email them the link, so the transfer wasn't started. Please try again." };
  }

  revalidateAdmins();
  return {};
}

// Cancels the waiting transfer: its link stops working.
export async function cancelTransfer(): Promise<ActionState> {
  await requireOwner();
  await prisma.ownershipTransfer.deleteMany({});
  revalidateAdmins();
  return {};
}

// A reason the transfer can't be accepted, shown to the person accepting.
class TransferError extends Error {}

// Accepts ownership from a transfer link: the signed-in admin must be the
// one it was sent to. The old owner becomes an editor and is emailed.
// Everything is checked again inside one transaction, so a link that was
// cancelled, or accepted twice at the same moment, can't make two owners
// (the database also allows only one).
export async function acceptTransfer(token: string): Promise<ActionState> {
  const admin = await requireAdmin();

  let transfer;
  try {
    transfer = await prisma.$transaction(async (tx) => {
      const found = await tx.ownershipTransfer.findUnique({
        where: { tokenHash: hashToken(token) },
        select: {
          id: true,
          expiresAt: true,
          toId: true,
          from: { select: { id: true, email: true, name: true } },
        },
      });
      if (!found) throw new TransferError("This link no longer works. The transfer may have been cancelled or already accepted.");
      if (found.toId !== admin.id) throw new TransferError("This link is for a different admin.");
      if (found.expiresAt <= new Date()) throw new TransferError("This link has expired. Ask the owner to send a new one.");

      // Claims the transfer: if it was accepted or cancelled in the
      // meantime, there's nothing left to delete.
      const claimed = await tx.ownershipTransfer.deleteMany({ where: { id: found.id } });
      if (claimed.count === 0) throw new TransferError("This link no longer works. The transfer may have been cancelled or already accepted.");

      const demoted = await tx.user.updateMany({
        where: { id: found.from.id, role: "OWNER" },
        data: { role: "EDITOR" },
      });
      if (demoted.count === 0) {
        throw new TransferError(`${found.from.name || found.from.email} isn't the owner anymore, so they can't hand it over.`);
      }
      await tx.user.update({ where: { id: admin.id }, data: { role: "OWNER" } });
      await tx.ownershipTransfer.deleteMany({});
      return found;
    });
  } catch (error) {
    if (error instanceof TransferError) return { error: error.message };
    console.error("Failed to accept ownership transfer", error);
    return { error: "Something went wrong accepting ownership. Please try again." };
  }

  try {
    await sendTransferDone({ to: transfer.from, newOwner: admin });
  } catch (error) {
    // Ownership has already changed hands; the email is only a record.
    console.error("Failed to email the old owner about the transfer", error);
  }

  revalidateAdmins();
  redirect("/admin/admins");
}
