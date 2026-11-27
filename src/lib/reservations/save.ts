import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { BuildErrors, BuildInput, ReservationInput } from "@/lib/form-builds";
import { prisma } from "@/lib/prisma";

// Saving the spots editors reserve at a form's builds, from the form editor
// (see Reservation). Callers must run requireEditor() first.

type Db = typeof prisma | Prisma.TransactionClient;

const fullName = (reservation: ReservationInput) => `${reservation.firstName} ${reservation.lastName}`;

// Problems with the reserved spots from the rest of the day, by build
// position, or null: a volunteer can only be at one form a day, so they
// can't have a reserved spot here if they have one on another of the day's
// forms or are signed up (or waiting) through one. Forms whose event was
// cancelled don't count.
export async function reservationConflicts(
  db: Db,
  builds: BuildInput[],
  date: Date,
  formId?: string,
): Promise<Record<number, BuildErrors> | null> {
  const emails = builds.flatMap((build) => build.reservations.map((reservation) => reservation.email));
  if (emails.length === 0) return null;
  const otherForm = { date, status: { not: "CANCELLED" as const }, ...(formId && { id: { not: formId } }) };
  const [reserved, signedUp] = await Promise.all([
    db.reservation.findMany({
      where: { email: { in: emails }, form: otherForm },
      select: { email: true, form: { select: { name: true } } },
    }),
    db.formSignup.findMany({
      where: { cancelledAt: null, volunteer: { email: { in: emails } }, form: otherForm },
      select: { volunteer: { select: { email: true } }, form: { select: { name: true } } },
    }),
  ]);
  const problems = new Map<string, string>();
  for (const { email, form } of reserved) problems.set(email, `has a reserved spot on ${form.name} that day`);
  for (const { volunteer, form } of signedUp) problems.set(volunteer.email, `is signed up through ${form.name} that day`);

  const errors: Record<number, BuildErrors> = {};
  builds.forEach((build, index) => {
    const conflict = build.reservations.find((reservation) => problems.has(reservation.email));
    if (conflict) {
      errors[index] = {
        reservations: `${fullName(conflict)} ${problems.get(conflict.email)}, and a volunteer can only be at one form a day.`,
      };
    }
  });
  return Object.keys(errors).length > 0 ? errors : null;
}

// What changed when a form's reserved spots were saved.
export type ReservationChanges = {
  // Spots reserved, or moved to another build: they need room there.
  added: Set<string>; // shift IDs
  // Spots given back to general volunteers.
  released: boolean;
};

// A reason the reserved spots can't be saved as sent.
export class ReservationProblem extends Error {
  constructor(
    message: string,
    readonly buildErrors?: Record<number, BuildErrors>,
  ) {
    super(message);
  }
}

// Saves a form's reserved spots as the form editor sent them, with each
// build's ID (shiftIds, by the builds' positions). Run inside the
// transaction that saves the form, holding its lock. Throws a
// ReservationProblem if one can't be saved:
//   - A spot someone signed up with stays where it is: it's released when
//     they cancel. The editor doesn't offer removing or moving one, so its
//     page is out of date.
//   - New spots can't go at a cancelled build.
//   - Nothing can change once the first build has started (locked).
// A new spot for someone already signed up on the form (or waiting) is
// theirs at once: their choice of builds becomes that build, they're off
// the waitlist, and with custom assignments they're assigned there.
export async function saveReservations(
  tx: Prisma.TransactionClient,
  formId: string,
  builds: BuildInput[],
  shiftIds: string[],
  options: { createdByName: string; locked: boolean; assignmentsSaved: boolean },
): Promise<ReservationChanges> {
  const STALE = "This form's reserved spots were changed somewhere else. Refresh the page and make your changes again.";
  const existing = await tx.reservation.findMany({
    where: { formId },
    select: { id: true, email: true, shiftId: true, signupId: true },
  });
  const byEmail = new Map(existing.map((reservation) => [reservation.email, reservation]));
  const sent = new Map<string, { reservation: ReservationInput; shiftId: string; index: number }>();
  builds.forEach((build, index) => {
    for (const reservation of build.reservations) sent.set(reservation.email, { reservation, shiftId: shiftIds[index], index });
  });

  const changes: ReservationChanges = { added: new Set(), released: false };
  const problem = (message: string) => {
    throw new ReservationProblem(message);
  };

  for (const reservation of existing) {
    const kept = sent.get(reservation.email);
    if (kept?.shiftId === reservation.shiftId) continue;
    if (reservation.signupId) problem(STALE);
    if (options.locked) problem(LOCKED);
    if (kept) {
      await tx.reservation.update({ where: { id: reservation.id }, data: { shiftId: kept.shiftId } });
      changes.added.add(kept.shiftId);
    } else {
      await tx.reservation.delete({ where: { id: reservation.id } });
    }
    changes.released = true;
  }

  for (const [email, { reservation, shiftId, index }] of sent) {
    if (byEmail.has(email)) continue;
    if (options.locked) problem(LOCKED);
    if (builds[index].cancelled) {
      throw new ReservationProblem("", {
        [index]: { reservations: "This build is cancelled. Restore it before reserving spots at it." },
      });
    }
    const created = await tx.reservation.create({
      data: { formId, shiftId, ...reservation, createdByName: options.createdByName },
      select: { id: true },
    });
    changes.added.add(shiftId);

    const signup = await tx.formSignup.findFirst({
      where: { formId, cancelledAt: null, volunteer: { email } },
      select: { id: true },
    });
    if (!signup) continue;
    await tx.reservation.update({ where: { id: created.id }, data: { signupId: signup.id } });
    await tx.shiftPreference.deleteMany({ where: { signupId: signup.id } });
    await tx.shiftPreference.create({ data: { signupId: signup.id, shiftId } });
    await tx.formSignup.update({
      where: { id: signup.id },
      data: { waitlistedAt: null, ...(options.assignmentsSaved && { assignedShiftId: shiftId }) },
    });
  }
  return changes;
}

const LOCKED = "Reserved spots can't be changed once the first build has started.";
