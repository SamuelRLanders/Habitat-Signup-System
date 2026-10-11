import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Transportation } from "@/generated/prisma/enums";
import { currentApproval } from "@/lib/drivers/status";
import { isHighlyExperienced } from "@/lib/experience";
import type { RosterSignup } from "@/lib/form-signups/rosters";
import { prisma } from "@/lib/prisma";
import type { OfferedShift } from "@/lib/signup-forms/queries";
import {
  planDay,
  tallyPlacement,
  type Day,
  type DayPlan,
  type Placement,
  type PlacementVolunteer,
} from "./solver";
import { travelRoster } from "./travel-roster";

// A form's signups, ready for the placement solver (./solver.ts). Its
// builds are the ones the form offers, and its volunteers are the signups
// that haven't been cancelled.

type Db = typeof prisma | Prisma.TransactionClient;

// How a signup counts when placing volunteers.
//   - Drivers (approved or waiting for approval) bring their car's seats.
//     Pending drivers count, so signups aren't held up waiting on Purdue;
//     admins see which placed drivers are still pending.
//   - Someone who offered to drive but is no longer approved has a car to
//     get there themselves, so they count as getting there on their own.
//   - Signups without a car or an answer (from before the form required
//     them) count as needing a ride, to be safe.
//   - On a form that doesn't ask how volunteers are getting there,
//     everyone gets there on their own, whatever they said before it
//     stopped asking.
export function travelOf(
  transportation: Transportation | null,
  carSeats: number | null,
  canDriveOthers: boolean,
  askTransportation: boolean,
): Pick<PlacementVolunteer, "travel" | "carSeats"> {
  if (!askTransportation) return { travel: "ownWay", carSeats: 0 };
  const hasCar = carSeats !== null && carSeats > 0;
  if (transportation === "CAN_DRIVE" && hasCar) {
    return canDriveOthers ? { travel: "driver", carSeats } : { travel: "ownWay", carSeats: 0 };
  }
  if (transportation === "OWN_WAY") return { travel: "ownWay", carSeats: 0 };
  return { travel: "rider", carSeats: 0 };
}

type SignupForPlacement = {
  id: string;
  transportation: Transportation | null;
  carSeats: number | null;
  // Approved or waiting for approval as a driver.
  canDriveOthers: boolean;
  // The shifts they chose that the form still offers.
  shiftIds: string[];
  // Highly experienced, for the plan for admins.
  experienced?: boolean;
};

// Which of a form's optional questions it asks (see SignupForm).
export type FormQuestions = { askTransportation: boolean; askGroups: boolean };

// The solver's view of a day. Signups whose chosen shifts have all been
// cancelled are left out: they can't be placed and don't take a spot.
export function placementDay(
  shifts: { id: string; capacity: number }[],
  signups: SignupForPlacement[],
  askTransportation: boolean,
): Day {
  return {
    builds: shifts.map(({ id, capacity }) => ({ id, capacity })),
    volunteers: signups.flatMap((signup) =>
      signup.shiftIds.length === 0
        ? []
        : [
            {
              id: signup.id,
              ...travelOf(signup.transportation, signup.carSeats, signup.canDriveOthers, askTransportation),
              buildIds: signup.shiftIds,
              experienced: signup.experienced,
            },
          ],
    ),
  };
}

// Loads a form's signups for placing. Pass the transaction client when
// deciding on a new signup, so it sees the signups as of the form's lock.
export async function loadPlacementDay(
  db: Db,
  formId: string,
  shifts: { id: string; capacity: number }[],
  askTransportation: boolean,
): Promise<Day> {
  const offered = new Set(shifts.map((shift) => shift.id));
  const signups = await db.formSignup.findMany({
    where: { formId, cancelledAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      transportation: true,
      carSeats: true,
      preferences: { select: { shiftId: true } },
      volunteer: {
        select: {
          driverRequestedAt: true,
          driverApprovals: { where: currentApproval(), take: 1, select: { id: true } },
        },
      },
    },
  });

  return placementDay(
    shifts,
    signups.map((signup) => ({
      id: signup.id,
      transportation: signup.transportation,
      carSeats: signup.carSeats,
      canDriveOthers:
        signup.volunteer.driverRequestedAt !== null || signup.volunteer.driverApprovals.length > 0,
      // A cancelled build isn't offered.
      shiftIds: signup.preferences.map((p) => p.shiftId).filter((id) => offered.has(id)),
    })),
    askTransportation,
  );
}

// Pairs of signups (by ID) who asked to be placed together: one asked for
// the other's email. One request is enough, so each pair is listed once.
// None on a form that doesn't ask.
export function requestedPairs(
  signups: { id: string; email: string; groupEmails: string[] }[],
  askGroups: boolean,
): [string, string][] {
  if (!askGroups) return [];
  const byEmail = new Map(signups.map((signup) => [signup.email, signup.id]));
  const pairs = new Map<string, [string, string]>();
  for (const signup of signups) {
    for (const email of signup.groupEmails) {
      const other = byEmail.get(email);
      if (!other || other === signup.id) continue;
      const pair: [string, string] = signup.id < other ? [signup.id, other] : [other, signup.id];
      pairs.set(pair.join(), pair);
    }
  }
  return [...pairs.values()];
}

// The plan for a form's active signups, for admins, with who's left out
// and how many placed drivers are still waiting for approval. Until an
// admin saves custom assignments, it's the app's likely plan, sending
// someone highly experienced to each build and keeping friends who asked
// to be together where it can. With custom assignments
// (custom is true), it's those, whatever the rules say: anyone not
// assigned a build is left out.
export function planForRoster(
  shifts: { id: string; capacity: number }[],
  signups: RosterSignup[],
  questions: FormQuestions,
  custom = false,
) {
  const day = placementDay(
    shifts,
    signups.map((signup) => ({
      ...signup,
      canDriveOthers: signup.driver.status !== "none",
      experienced: isHighlyExperienced(signup.builds),
    })),
    questions.askTransportation,
  );
  let plan: Pick<DayPlan, "placement" | "builds" | "proven" | "leftOut">;
  if (custom) {
    // Admins can assign anyone, even someone whose builds were all
    // cancelled, so every signup counts.
    day.volunteers = signups.map((signup) => ({
      id: signup.id,
      ...travelOf(signup.transportation, signup.carSeats, signup.driver.status !== "none", questions.askTransportation),
      buildIds: signup.shiftIds,
      experienced: isHighlyExperienced(signup.builds),
    }));
    const placement: Placement = new Map(
      signups.flatMap((signup) => (signup.assignedShiftId ? [[signup.id, signup.assignedShiftId]] : [])),
    );
    plan = {
      placement,
      builds: tallyPlacement(day, placement),
      proven: true,
      leftOut: signups.filter((signup) => !placement.has(signup.id)).map((signup) => signup.id),
    };
  } else {
    day.together = requestedPairs(signups, questions.askGroups);
    plan = planDay(day);
  }

  const byId = new Map(signups.map((signup) => [signup.id, signup]));
  const pendingDrivers = new Map<string, number>(); // by shift ID
  for (const volunteer of day.volunteers) {
    const shiftId = plan.placement.get(volunteer.id);
    if (volunteer.travel !== "driver" || !shiftId) continue;
    if (byId.get(volunteer.id)!.driver.status === "pending") {
      pendingDrivers.set(shiftId, (pendingDrivers.get(shiftId) ?? 0) + 1);
    }
  }

  return {
    custom,
    placement: plan.placement,
    builds: plan.builds,
    proven: plan.proven,
    leftOut: plan.leftOut.map((id) => byId.get(id)!),
    pendingDrivers,
    // Drivers still needed: a spot is held for each.
    driversNeeded: [...plan.builds.values()].reduce((sum, build) => sum + build.heldDriverSpots, 0),
    // Signups whose chosen shifts have all been cancelled, and who aren't
    // assigned anywhere.
    withoutShifts: signups.filter((signup) => signup.shiftIds.length === 0 && !plan.placement.has(signup.id)),
  };
}

// Purdue's travel roster for a form's day (day is "2026-10-24"), following
// a plan from planForRoster().
export function travelRosterFor(
  day: string,
  shifts: OfferedShift[],
  signups: RosterSignup[],
  placement: Placement,
  questions: FormQuestions,
) {
  return travelRoster({
    day,
    builds: shifts.map((shift) => ({ id: shift.id, address: shift.address })),
    volunteers: signups.map((signup) => ({
      id: signup.id,
      name: `${signup.firstName} ${signup.lastName}`,
      phone: signup.phone,
      ...travelOf(
        signup.transportation,
        signup.carSeats,
        signup.driver.status !== "none",
        questions.askTransportation,
      ),
      driverStatus: signup.driver.status,
    })),
    placement,
    together: requestedPairs(signups, questions.askGroups),
  });
}
