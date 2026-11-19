"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireEditor } from "@/lib/auth/dal";
import type { ActionState, FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { fromDay, toDay } from "@/lib/time";
import { PurdueListError, readPurdueList } from "./purdue-list";
import { matchPurdueList, type ListCheck } from "./purdue-match";
import { currentApproval, driverToday } from "./status";

// Admins deciding on volunteers' driver approvals. Every action calls
// requireEditor() first, and each decision keeps the admin's name.

function revalidateDrivers() {
  revalidatePath("/admin", "layout");
}

const untilSchema = z.iso.date("Choose the last day of the approval.");

export type ApproveDriverState = FormState<"approvedUntil">;

// Approves a pending driver through a day.
export async function approveDriver(
  volunteerId: string,
  _prev: ApproveDriverState,
  formData: FormData,
): Promise<ApproveDriverState> {
  const admin = await requireEditor();

  const until = untilSchema.safeParse(formData.get("approvedUntil"));
  if (!until.success) return { errors: { approvedUntil: until.error.issues[0].message } };
  if (until.data < driverToday()) {
    return { errors: { approvedUntil: "The approval has to last until today or later." } };
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    select: { driverRequestedAt: true },
  });
  if (!volunteer?.driverRequestedAt) {
    return { errors: { form: "This volunteer isn't waiting for approval anymore." } };
  }

  await recordApproval(admin, volunteerId, volunteer.driverRequestedAt, until.data);
  revalidateDrivers();
  return { success: true };
}

type Admin = Awaited<ReturnType<typeof requireEditor>>;

// Saves an approval through a day and ends the volunteer's pending
// request. Drivers aren't emailed: the signup form shows their approval.
async function recordApproval(
  admin: Admin,
  volunteerId: string,
  requestedAt: Date,
  until: string,
) {
  await prisma.$transaction([
    prisma.driverApproval.create({
      data: {
        volunteerId,
        decision: "APPROVED",
        requestedAt,
        approvedUntil: fromDay(until),
        decidedByName: admin.name || admin.email,
        decidedById: admin.id,
      },
    }),
    prisma.volunteer.update({ where: { id: volunteerId }, data: { driverRequestedAt: null } }),
  ]);
}

// ─── Purdue's approved driver list ───────────────────────────────────────────

const MAX_LIST_BYTES = 4 * 1024 * 1024;

export type PurdueListState = {
  error?: string;
  check?: ListCheck;
  checkedAt?: number;
};

// Reads an uploaded copy of Purdue's ApprovedDrivers.xlsx and matches it
// against pending and approved drivers. Nothing is saved: the file is only
// read, and the matches are shown for an admin to approve.
export async function checkPurdueList(
  _prev: PurdueListState,
  formData: FormData,
): Promise<PurdueListState> {
  await requireEditor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the ApprovedDrivers.xlsx file you downloaded." };
  }
  if (file.size > MAX_LIST_BYTES) return { error: "That file is too big. It should be under 4 MB." };

  try {
    const list = await readPurdueList(await file.arrayBuffer());
    return { check: await matchPurdueList(list), checkedAt: Date.now() };
  } catch (error) {
    if (error instanceof PurdueListError) return { error: error.message };
    console.error("Failed to read Purdue's driver list", error);
    return { error: "Something went wrong reading that file. Please try again." };
  }
}

const listApprovalsSchema = z
  .array(z.object({ volunteerId: z.string().min(1), until: z.iso.date() }))
  .min(1)
  .max(500);

export type ListApprovalResult = { error?: string; approved?: string[] };

// Approves the matches an admin confirmed from Purdue's list: pending
// drivers are approved, and approved drivers Purdue renewed get a new
// approval through the later day. Each is checked again here.
export async function approveFromPurdueList(
  entries: { volunteerId: string; until: string }[],
): Promise<ListApprovalResult> {
  const admin = await requireEditor();

  const parsed = listApprovalsSchema.safeParse(entries);
  if (!parsed.success) return { error: "Nothing to approve." };

  const today = driverToday();
  const approved: string[] = [];
  for (const { volunteerId, until } of parsed.data) {
    if (until < today) continue;
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: volunteerId },
      select: {
        driverRequestedAt: true,
        driverApprovals: { where: currentApproval(today), orderBy: { approvedUntil: "desc" }, take: 1 },
      },
    });
    if (!volunteer) continue;
    const currentUntil = volunteer.driverApprovals[0]?.approvedUntil;
    const renewed = currentUntil && until > toDay(currentUntil);
    if (!volunteer.driverRequestedAt && !renewed) continue;

    await recordApproval(admin, volunteerId, volunteer.driverRequestedAt ?? new Date(), until);
    approved.push(volunteerId);
  }

  revalidateDrivers();
  return { approved };
}

// Declines a pending driver, such as someone who never filled out the form.
// They're asked again on their next signup.
export async function declineDriver(volunteerId: string): Promise<ActionState> {
  const admin = await requireEditor();

  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    select: { driverRequestedAt: true },
  });
  if (!volunteer?.driverRequestedAt) {
    return { error: "This volunteer isn't waiting for approval anymore." };
  }

  await prisma.$transaction([
    prisma.driverApproval.create({
      data: {
        volunteerId,
        decision: "DECLINED",
        requestedAt: volunteer.driverRequestedAt,
        decidedByName: admin.name || admin.email,
        decidedById: admin.id,
      },
    }),
    prisma.volunteer.update({ where: { id: volunteerId }, data: { driverRequestedAt: null } }),
  ]);
  revalidateDrivers();
  return {};
}

// Ends an approval early. The record is kept, marked revoked.
export async function revokeDriver(approvalId: string): Promise<ActionState> {
  const admin = await requireEditor();

  const { count } = await prisma.driverApproval.updateMany({
    where: { id: approvalId, decision: "APPROVED", revokedAt: null },
    data: { revokedAt: new Date(), revokedByName: admin.name || admin.email },
  });
  if (count === 0) return { error: "This approval has already ended." };

  revalidateDrivers();
  return {};
}
