"use server";

import { revalidatePath } from "next/cache";
import { textWhere } from "@/lib/admin/queries";
import { requireEditor } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { ALREADY_SIGNED_UP, ALREADY_WAITING } from "@/lib/reservations/save";
import { formPhase } from "@/lib/signup-forms/phase";

// Reserved spots (see Reservation): finding a volunteer to reserve one for,
// in the form editor's "Reserve a spot" popup (the spot itself is saved
// with the form), and adding a volunteer to theirs on the Assignments tab
// once the form has closed. Each calls requireEditor() first: anyone can
// post to a Server Action. IDs sent are treated as untrusted.

// Signs up the volunteer a spot is reserved for, at its build, once the
// form has closed and they can't sign up themselves; until the day's first
// build starts. Their details are their latest; a signup they cancelled is
// reused, keeping how they said they'd get there. They need to have signed
// up for something before, so the app has their details. With custom
// assignments, they're assigned to the build. Nobody is emailed.
export async function addReserved(formId: string, reservationId: string): Promise<ActionState> {
  await requireEditor();
  if (typeof formId !== "string" || typeof reservationId !== "string") return { error: "Choose someone to add." };

  const result = await prisma.$transaction(async (tx): Promise<ActionState> => {
    // Locked, as a signup does, so nothing else changes the form meanwhile.
    await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
    const form = await tx.signupForm.findUnique({
      where: { id: formId },
      select: {
        date: true,
        status: true,
        opensAt: true,
        closesAt: true,
        askTransportation: true,
        assignmentsSavedAt: true,
        placementSavedAt: true,
      },
    });
    if (!form) return { error: "This form no longer exists." };
    if (formPhase(form) !== "closed" || form.placementSavedAt) {
      return { error: "Volunteers with reserved spots can only be added here after the form closes, until the first build starts." };
    }
    const reservation = await tx.reservation.findFirst({
      where: { id: reservationId, formId, signupId: null, shift: { cancelledAt: null } },
      select: { id: true, email: true, firstName: true, lastName: true, shiftId: true },
    });
    if (!reservation) return { error: "This reserved spot has changed. Refresh the page." };
    const name = `${reservation.firstName} ${reservation.lastName}`;

    const volunteer = await tx.volunteer.findUnique({
      where: { email: reservation.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        tShirtSize: true,
        hasDriversLicense: true,
        signups: {
          where: { cancelledAt: null, formId: { not: formId }, form: { date: form.date, status: { not: "CANCELLED" } } },
          select: { form: { select: { name: true } } },
        },
      },
    });
    if (!volunteer) {
      return { error: `${name} has never signed up, so the app doesn't have their details to add them.` };
    }
    if (volunteer.signups.length > 0) {
      return { error: `${name} is signed up through ${volunteer.signups[0].form.name} that day.` };
    }

    const volunteerId = volunteer.id;
    const details = {
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      phone: volunteer.phone,
      dateOfBirth: volunteer.dateOfBirth,
      tShirtSize: volunteer.tShirtSize,
      hasDriversLicense: volunteer.hasDriversLicense,
    };
    const assigned = { assignedShiftId: form.assignmentsSavedAt ? reservation.shiftId : null };
    const existing = await tx.formSignup.findUnique({
      where: { formId_volunteerId: { formId, volunteerId } },
      select: { id: true, cancelledAt: true },
    });
    const signup = existing
      ? await tx.formSignup.update({
          where: { id: existing.id },
          data: { ...details, ...assigned, cancelledAt: null, waitlistedAt: null },
          select: { id: true },
        })
      : await tx.formSignup.create({
          data: {
            ...details,
            ...assigned,
            // How they're getting there is unknown, so they count as
            // needing a ride, to be safe.
            transportation: form.askTransportation ? null : "OWN_WAY",
            formId,
            volunteerId,
          },
          select: { id: true },
        });
    await tx.shiftPreference.deleteMany({ where: { signupId: signup.id } });
    await tx.shiftPreference.create({ data: { signupId: signup.id, shiftId: reservation.shiftId } });
    await tx.groupRequest.deleteMany({ where: { signupId: signup.id } });
    await tx.reservation.update({ where: { id: reservation.id }, data: { signupId: signup.id } });
    return {};
  });

  if (!result.error) revalidatePath("/admin", "layout");
  return result;
}

export type ReserveCandidate = {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  blocked: string | null;
};

const CANDIDATE_LIMIT = 6;

// Volunteers matching a search, by name, email or phone. On a form that's
// been saved (formId), anyone signed up on it, or waiting, can't be chosen:
// they have their signup. Whether they're free that day is checked when the
// form is saved, since its day can still change in the editor.
export async function searchToReserve(
  query: string,
  formId?: string,
): Promise<{ matches: ReserveCandidate[]; more: boolean }> {
  await requireEditor();
  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  const where = q ? textWhere({ by: "any", q }) : null;
  if (!where) return { matches: [], more: false };

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
        where: { formId: typeof formId === "string" ? formId : "", cancelledAt: null, reservation: null },
        select: { waitlistedAt: true },
      },
    },
  });
  return {
    matches: volunteers.slice(0, CANDIDATE_LIMIT).map(({ signups: [signup], ...volunteer }) => ({
      ...volunteer,
      name: `${volunteer.firstName} ${volunteer.lastName}`,
      blocked: signup ? sentence(signup.waitlistedAt ? ALREADY_WAITING : ALREADY_SIGNED_UP) : null,
    })),
    more: volunteers.length > CANDIDATE_LIMIT,
  };
}

// "is already signed up on this form, so…" → "Already signed up on this
// form, so…", for a match in the search.
function sentence(problem: string) {
  const rest = problem.replace(/^is /, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
