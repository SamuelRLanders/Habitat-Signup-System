import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { loadPlacementDay, loadWaiting, travelOf } from "@/lib/placement/load";
import { takeFromWaitlist } from "@/lib/placement/waitlist";
import { formPhase } from "@/lib/signup-forms/phase";
import { offeredShifts } from "@/lib/signup-forms/queries";

// Adding volunteers from a form's waitlist (FormSignup.waitlistedAt) while
// the form is open. It runs when room may have opened up: a volunteer
// cancelling, or an admin giving a build more spots. After the form
// closes, admins add waiting volunteers themselves on the Assignments tab.
// Nobody is emailed: volunteers were told on the form that they'd be
// added if someone cancels, and admins contact each build later.

// Goes through the waitlist in the order people joined, adding each one
// the day can now take at a build they chose, exactly as if they'd signed
// up then (src/lib/placement/waitlist.ts). Someone who still doesn't fit
// keeps their place, and the next person is tried. Returns how many were
// added. The caller must hold the form's lock (SELECT … FOR UPDATE) for
// the transaction, as a signup does, so nobody takes the same spot.
export async function fillFromWaitlist(tx: Prisma.TransactionClient, formId: string) {
  const form = await tx.signupForm.findUnique({
    where: { id: formId },
    select: {
      status: true,
      opensAt: true,
      closesAt: true,
      askTransportation: true,
      shifts: {
        where: offeredShifts.where,
        select: { id: true, capacity: true, _count: offeredShifts.select._count },
      },
    },
  });
  if (!form || formPhase(form) !== "open") return 0;

  const waiting = await loadWaiting(tx, formId, form.shifts);
  if (waiting.length === 0) return 0;

  const day = await loadPlacementDay(tx, formId, form.shifts, form.askTransportation);
  const added = takeFromWaitlist(
    day,
    waiting.map((signup) => ({
      id: signup.id,
      ...travelOf(signup.transportation, signup.carSeats, signup.canDriveOthers, form.askTransportation),
      buildIds: signup.shiftIds,
    })),
  );

  if (added.length > 0) {
    await tx.formSignup.updateMany({
      where: { id: { in: added }, cancelledAt: null },
      data: { waitlistedAt: null },
    });
  }
  return added.length;
}
