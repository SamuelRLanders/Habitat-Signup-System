"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/forms";
import type { Assignments } from "@/lib/placement/assignments";
import { prisma } from "@/lib/prisma";
import { adminPhase } from "./phase";

// Admins' custom assignments of volunteers to builds (src/lib/placement/
// assignments.ts). They can only be changed once the form has closed and
// before its event day is over. Admins are warned about anything that
// breaks the placement rules before saving, so these only check that the
// volunteers and builds belong to the form. Every action calls
// requireAdmin() first, and treats the IDs it's sent as untrusted.

function revalidateForm(formId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/forms/${formId}`);
}

// The form, locked until the transaction ends so two admins don't save over
// each other, or an error if its assignments can't be changed now.
async function lockForEditing(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], formId: string) {
  await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
  const form = await tx.signupForm.findUnique({
    where: { id: formId },
    select: { status: true, opensAt: true, closesAt: true, date: true, assignmentsSavedAt: true },
  });
  if (!form) return { error: "This form no longer exists." };
  const phase = adminPhase(form);
  if (phase === "passed") return { error: "This event day is over, so its assignments can't be changed." };
  if (phase !== "closed") return { error: "Assignments can only be changed once the form has closed." };
  return { form };
}

// Saves the assignments: volunteer (signup) ID → build ID, or null for not
// placed. savedAt is when the assignments the admin started from were saved
// (null for the app's), so changes made elsewhere since aren't overwritten.
// Signups not in the assignments, such as someone who signed up after a
// form was reopened, are saved as not placed.
export async function saveAssignments(
  formId: string,
  savedAt: string | null,
  assignments: Assignments,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (typeof assignments !== "object" || assignments === null) return { error: "Nothing to save." };

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockForEditing(tx, formId);
    if ("error" in locked) return locked;
    if ((locked.form.assignmentsSavedAt?.toISOString() ?? null) !== savedAt) {
      return {
        error: "Another admin changed these assignments since you opened them. Refresh the page to see theirs, then make your changes again.",
      };
    }

    const [signups, shifts] = await Promise.all([
      tx.formSignup.findMany({ where: { formId, cancelledAt: null }, select: { id: true } }),
      tx.shift.findMany({ where: { formId, cancelledAt: null }, select: { id: true } }),
    ]);
    const offered = new Set(shifts.map((shift) => shift.id));
    const byShift = new Map<string | null, string[]>();
    for (const { id } of signups) {
      const shiftId = assignments[id] ?? null;
      if (shiftId !== null && (typeof shiftId !== "string" || !offered.has(shiftId))) {
        return { error: "One of these builds is no longer on the form. Refresh the page and try again." };
      }
      byShift.set(shiftId, [...(byShift.get(shiftId) ?? []), id]);
    }

    for (const [assignedShiftId, ids] of byShift) {
      await tx.formSignup.updateMany({ where: { id: { in: ids } }, data: { assignedShiftId } });
    }
    await tx.signupForm.update({
      where: { id: formId },
      data: { assignmentsSavedAt: new Date(), assignmentsSavedByName: admin.name || admin.email },
    });
    return {};
  });

  if (!("error" in result)) revalidateForm(formId);
  return result;
}

// Goes back to the app's placement, forgetting the custom assignments.
export async function revertAssignments(formId: string): Promise<ActionState> {
  await requireAdmin();

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockForEditing(tx, formId);
    if ("error" in locked) return locked;
    await tx.formSignup.updateMany({ where: { formId }, data: { assignedShiftId: null } });
    await tx.signupForm.update({
      where: { id: formId },
      data: { assignmentsSavedAt: null, assignmentsSavedByName: null },
    });
    return {};
  });

  if (!("error" in result)) revalidateForm(formId);
  return result;
}
