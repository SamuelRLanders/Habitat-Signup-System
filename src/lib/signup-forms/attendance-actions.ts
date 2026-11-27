"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { textWhere } from "@/lib/admin/queries";
import { requireEditor } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { NO_SHOW, type AddCandidates, type Attendance } from "./attendance";

// Admins confirming where everyone went, once a form's planned assignments
// were saved when its day's first build started (SignupForm.placementSavedAt):
// moving people between builds, marking no-shows, and adding people who
// came without signing up. They can be changed for as long as the event
// is kept, so the Data page's numbers can be corrected. Nobody is emailed.
// Every action calls requireEditor() first, and treats the IDs it's sent as
// untrusted.

type Tx = Prisma.TransactionClient;

function revalidateForm() {
  revalidatePath("/admin", "layout");
}

// The form, locked until the transaction ends so two admins don't save over
// each other, or an error if its confirmed assignments can't be changed.
async function lockConfirming(tx: Tx, formId: string) {
  await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
  const form = await tx.signupForm.findUnique({
    where: { id: formId },
    select: { id: true, date: true, status: true, placementSavedAt: true, attendanceConfirmedAt: true },
  });
  if (!form) return { error: "This form no longer exists." };
  if (form.status === "CANCELLED") return { error: "This event was cancelled, so its assignments can't be changed." };
  if (form.status !== "PUBLISHED" || !form.placementSavedAt) {
    return { error: "Who went can only be confirmed once the form has closed and the first build has started." };
  }
  return { form };
}

// Saves changes to the confirmed assignments: signup ID → build ID,
// NO_SHOW, or null for not at any build. Only the signups sent change.
// confirmedAt is when the confirmed assignments the admin started from were
// saved (null if they hadn't been), so changes made elsewhere since aren't
// overwritten. Someone on the waitlist who's given a build came, so they're
// signed up from then on; null leaves them waiting. Only people who were
// signed up (not waiting, or added on the day) can be no-shows.
export async function saveAttendance(
  formId: string,
  confirmedAt: string | null,
  changes: Attendance,
): Promise<ActionState> {
  const admin = await requireEditor();
  if (typeof changes !== "object" || changes === null) return { error: "Nothing to save." };

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockConfirming(tx, formId);
    if ("error" in locked) return locked;
    if ((locked.form.attendanceConfirmedAt?.toISOString() ?? null) !== confirmedAt) {
      return {
        error: "Another admin changed these assignments since you opened them. Refresh the page to see theirs, then make your changes again.",
      };
    }

    const [signups, shifts] = await Promise.all([
      tx.formSignup.findMany({
        where: { formId, cancelledAt: null },
        select: { id: true, waitlistedAt: true, addedAt: true },
      }),
      tx.shift.findMany({ where: { formId, cancelledAt: null }, select: { id: true } }),
    ]);
    const byId = new Map(signups.map((signup) => [signup.id, signup]));
    const offered = new Set(shifts.map((shift) => shift.id));

    // Build ID, NO_SHOW or null → the signups going there.
    const groups = new Map<string | null, string[]>();
    for (const [id, value] of Object.entries(changes)) {
      const signup = byId.get(id);
      if (!signup) {
        return { error: "Someone on these assignments is no longer on the form. Refresh the page and try again." };
      }
      if (value !== null && value !== NO_SHOW && (typeof value !== "string" || !offered.has(value))) {
        return { error: "One of these builds is no longer on the form. Refresh the page and try again." };
      }
      if (value === NO_SHOW && (signup.waitlistedAt || signup.addedAt)) {
        return { error: "Only people who were signed up to go can be no-shows." };
      }
      if (value === null && signup.waitlistedAt) continue;
      groups.set(value, [...(groups.get(value) ?? []), id]);
    }

    for (const [value, ids] of groups) {
      await tx.formSignup.updateMany({
        where: { id: { in: ids } },
        data:
          value === NO_SHOW
            ? { assignedShiftId: null, noShow: true }
            : value === null
              ? { assignedShiftId: null, noShow: false }
              : { assignedShiftId: value, noShow: false, waitlistedAt: null },
      });
    }
    await tx.signupForm.update({
      where: { id: formId },
      data: { attendanceConfirmedAt: new Date(), attendanceConfirmedByName: admin.name || admin.email },
    });
    return {};
  });

  if (!("error" in result)) revalidateForm();
  return result;
}

// Goes back to the planned assignments: everyone returns to the build they
// were going to when the first build started, no-shows are cleared, and
// people admins added are taken off. Anyone moved from the waitlist stays
// signed up, at no build.
export async function revertAttendance(formId: string): Promise<ActionState> {
  await requireEditor();

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockConfirming(tx, formId);
    if ("error" in locked) return locked;
    await tx.$executeRaw`
      UPDATE "FormSignup" SET "assignedShiftId" = "plannedShiftId", "noShow" = false
      WHERE "formId" = ${formId} AND "addedAt" IS NULL`;
    const added = await tx.formSignup.findMany({
      where: { formId, addedAt: { not: null } },
      select: { id: true, createdAt: true, addedAt: true },
    });
    for (const signup of added) await takeOff(tx, signup);
    await tx.signupForm.update({
      where: { id: formId },
      data: { attendanceConfirmedAt: null, attendanceConfirmedByName: null },
    });
    return {};
  });

  if (!("error" in result)) revalidateForm();
  return result;
}

// Adds a volunteer who came without signing up, or after cancelling, to an
// event's confirmed assignments, at no build: the admin then moves them to
// the build they went to. A cancelled signup is reused; otherwise a signup
// is made from their details. Someone signed up through another form that
// day can't be added, unless they're a no-show there, so nobody counts as
// going to two builds.
export async function addToConfirmed(formId: string, volunteerId: string): Promise<ActionState> {
  const admin = await requireEditor();
  if (typeof volunteerId !== "string") return { error: "Choose someone to add." };

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockConfirming(tx, formId);
    if ("error" in locked) return locked;
    const volunteer = await tx.volunteer.findUnique({
      where: { id: volunteerId },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        tShirtSize: true,
        hasDriversLicense: true,
        signups: {
          where: { form: { date: locked.form.date, status: { not: "CANCELLED" } } },
          select: { id: true, formId: true, cancelledAt: true, waitlistedAt: true, noShow: true, form: { select: { name: true } } },
        },
      },
    });
    if (!volunteer) return { error: "This volunteer no longer exists." };
    const blocked = whyNotAdd(formId, volunteer.signups);
    if (blocked) return { error: `${volunteer.firstName} ${volunteer.lastName}: ${blocked}` };

    const now = new Date();
    const added = { addedAt: now, addedByName: admin.name || admin.email };
    const cancelled = volunteer.signups.find((signup) => signup.formId === formId);
    if (cancelled) {
      await tx.formSignup.update({
        where: { id: cancelled.id },
        data: { ...added, cancelledAt: null, waitlistedAt: null, assignedShiftId: null, noShow: false },
      });
    } else {
      await tx.formSignup.create({
        data: {
          firstName: volunteer.firstName,
          lastName: volunteer.lastName,
          phone: volunteer.phone,
          dateOfBirth: volunteer.dateOfBirth,
          tShirtSize: volunteer.tShirtSize,
          hasDriversLicense: volunteer.hasDriversLicense,
          ...added,
          createdAt: now,
          formId,
          volunteerId,
        },
      });
    }
    return {};
  });

  if (!("error" in result)) revalidateForm();
  return result;
}

// Takes someone an admin added off an event's confirmed assignments, such
// as when they were added by mistake.
export async function removeAdded(formId: string, signupId: string): Promise<ActionState> {
  await requireEditor();

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockConfirming(tx, formId);
    if ("error" in locked) return locked;
    const signup = await tx.formSignup.findFirst({
      where: { id: signupId, formId, addedAt: { not: null }, cancelledAt: null },
      select: { id: true, createdAt: true, addedAt: true },
    });
    if (!signup) return { error: "They're no longer on these assignments. Refresh the page." };
    await takeOff(tx, signup);
    return {};
  });

  if (!("error" in result)) revalidateForm();
  return result;
}

// A signup made when they were added is deleted; one that was reused is
// cancelled again.
async function takeOff(tx: Tx, signup: { id: string; createdAt: Date; addedAt: Date | null }) {
  if (signup.addedAt && signup.createdAt.getTime() === signup.addedAt.getTime()) {
    await tx.formSignup.delete({ where: { id: signup.id } });
  } else {
    await tx.formSignup.update({
      where: { id: signup.id },
      data: {
        cancelledAt: signup.addedAt ?? new Date(),
        addedAt: null,
        addedByName: null,
        assignedShiftId: null,
        noShow: false,
      },
    });
  }
}

// Why a volunteer can't be added to a form, from their signups for its day
// (on forms that aren't cancelled), or null.
function whyNotAdd(
  formId: string,
  signups: { formId: string; cancelledAt: Date | null; waitlistedAt: Date | null; noShow: boolean; form: { name: string } }[],
) {
  for (const signup of signups) {
    if (signup.cancelledAt) continue;
    if (signup.formId === formId) return "Already on these assignments";
    if (!signup.waitlistedAt && !signup.noShow) {
      return `Signed up through ${signup.form.name} that day. Mark them a no-show there first.`;
    }
  }
  return null;
}

const CANDIDATE_LIMIT = 6;

// Volunteers matching a search, for adding to a form's confirmed
// assignments, with why any can't be.
export async function searchToAdd(formId: string, query: string): Promise<AddCandidates> {
  await requireEditor();
  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  const where = q ? textWhere({ by: "any", q }) : null;
  const form = typeof formId === "string"
    ? await prisma.signupForm.findUnique({ where: { id: formId }, select: { date: true } })
    : null;
  if (!where || !form) return { matches: [], more: false };

  const volunteers = await prisma.volunteer.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    take: CANDIDATE_LIMIT + 1,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      signups: {
        where: { form: { date: form.date, status: { not: "CANCELLED" } } },
        select: { formId: true, cancelledAt: true, waitlistedAt: true, noShow: true, form: { select: { name: true } } },
      },
    },
  });

  return {
    matches: volunteers.slice(0, CANDIDATE_LIMIT).map((volunteer) => ({
      id: volunteer.id,
      name: `${volunteer.firstName} ${volunteer.lastName}`,
      email: volunteer.email,
      blocked: whyNotAdd(formId, volunteer.signups),
      note: volunteer.signups.some((signup) => signup.formId === formId && signup.cancelledAt)
        ? "Cancelled their signup"
        : null,
    })),
    more: volunteers.length > CANDIDATE_LIMIT,
  };
}
