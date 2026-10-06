import { solve, type Model } from "yalps";
import { MAX_CAR_SEATS, MIN_CAR_SEATS } from "@/lib/volunteers";
import type { BuildRoom } from "./room";

// ═════════════════════════════════════════════════════════════════════════════
// Placing volunteers at builds
// ═════════════════════════════════════════════════════════════════════════════
//
// A build day can have several builds, each with a number of spots. Every
// volunteer who signs up chooses the builds they could work at, and says how
// they're getting there:
//
//   • a rider needs a seat in someone's car,
//   • an own-way volunteer gets there by themselves, and
//   • a driver brings their car, with room for (seats − 1) passengers.
//
// Each volunteer will work at exactly one of the builds they chose. Admins
// decide which later, so until then volunteers can be moved between the
// builds they chose to make room for others.
//
// THE RULES
//
// A plan (a "placement") puts each volunteer at one of the builds they
// chose, and at every build:
//
//   1. Room. The volunteers placed there, plus the spots held for drivers
//      (see below), fit in the build's spots.
//
//   2. Rides. Every rider placed there has a seat, either in the car of a
//      driver placed at the same build or in a car we're still waiting for.
//
// Riders can sign up before there are enough drivers, but we hold spots open
// for the drivers they'll need. We assume a driver who hasn't signed up yet
// brings a 4-seat car, with room for 3 passengers. So for every 3 riders
// without a seat (or fewer, for the last car) one spot is held, and only a
// driver can take it. A car goes to one build, so it can only carry riders
// placed at that build.
//
//   Example: a build with 10 spots has 6 riders, 2 own-way volunteers and no
//   drivers. The 6 riders need 2 cars, so 2 spots are held for drivers:
//   6 + 2 + 2 = 10. The build is full for everyone but drivers.
//
//   If a driver with a 7-seat car then signs up, their 6 passenger seats
//   cover all 6 riders, so no spots are held anymore: 6 + 2 + 1 = 9, leaving
//   1 spot. Another rider couldn't take it, since they'd need a car (and a
//   held spot) of their own: 7 + 2 + 1 + 1 = 11. An own-way volunteer or
//   another driver could.
//
// A day can take a new signup if there's still a plan that places everyone,
// the new volunteer included. A build can take one if there's a plan that
// places them there. Because volunteers can be moved around, that depends on
// everyone's choices, not just on how many people chose that build.
//
// THE METHOD
//
// Finding a plan is a puzzle with whole-number answers ("how many of these
// volunteers go to that build?"), which is called an integer program. We
// write the rules down as simple sums and let a solver (the yalps library)
// search for numbers that satisfy them. It's fast for the size of a build
// day, usually well under a millisecond.
//
// (Without cars this would be a matching problem that max-flow solves
// directly. Cars are what make it different: a car's seats all go wherever
// its driver goes, and held spots come in whole cars.)
//
// The solver only ever proposes a plan. Every plan it returns is checked
// against the rules by checkPlacement() below, a direct, step-by-step
// version of rules 1 and 2, so a bug or rounding error in the solver can't
// let in a volunteer who doesn't fit.
//
// This file has no database code (see ./day.ts for that), so it can be
// tested on its own (./solver.test.ts).

// ─── The day ─────────────────────────────────────────────────────────────────

// How a volunteer is getting to the build.
export type Travel = "rider" | "ownWay" | "driver";

// A build working that day. Each build has one shift a day, so callers use
// the shift's ID and its number of spots.
export type PlacementBuild = {
  id: string;
  capacity: number;
};

export type PlacementVolunteer = {
  id: string;
  travel: Travel;
  // Seats in a driver's car, counting the driver's. Ignored for riders and
  // own-way volunteers.
  carSeats: number;
  // The builds they could work at.
  buildIds: string[];
};

export type Day = {
  builds: PlacementBuild[];
  volunteers: PlacementVolunteer[];
};

// Where each volunteer is placed: volunteer ID → build ID. Volunteers who
// couldn't be placed aren't in it.
export type Placement = Map<string, string>;

// ─── The rules ───────────────────────────────────────────────────────────────

// The car we assume a driver who hasn't signed up yet will bring, counting
// the driver's seat.
export const ASSUMED_CAR_SEATS = 4;
const PASSENGERS_PER_HELD_SPOT = ASSUMED_CAR_SEATS - 1;

// Seats a volunteer brings for riders: a driver's seats minus their own.
function passengerSeats(volunteer: PlacementVolunteer) {
  return volunteer.travel === "driver" ? Math.max(0, volunteer.carSeats - 1) : 0;
}

// The spots to hold for drivers at a build: one per assumed car needed by
// the riders who don't have a seat. 7 riders and 2 seats leave 5 riders
// without a seat, which takes 2 cars of 3 passengers each, so 2 spots.
export function heldDriverSpots(riders: number, seats: number) {
  return Math.max(0, Math.ceil((riders - seats) / PASSENGERS_PER_HELD_SPOT));
}

// What a plan looks like at one build.
export type BuildPlan = {
  capacity: number;
  riders: number;
  ownWay: number;
  drivers: number;
  // Seats for riders in the cars of the drivers placed there.
  passengerSeats: number;
  // Spots held for drivers who haven't signed up yet.
  heldDriverSpots: number;
};

// Volunteers placed at a build, not counting held spots.
export function placedAt(build: BuildPlan) {
  return build.riders + build.ownWay + build.drivers;
}

// Checks a placement against the rules, one build at a time. Returns what
// each build looks like (by build ID), or null if the placement breaks a
// rule. Volunteers left out of the placement don't count anywhere.
export function checkPlacement(day: Day, placement: Placement): Map<string, BuildPlan> | null {
  const builds = new Map<string, BuildPlan>(
    day.builds.map((build) => [
      build.id,
      { capacity: build.capacity, riders: 0, ownWay: 0, drivers: 0, passengerSeats: 0, heldDriverSpots: 0 },
    ]),
  );

  // Tally who's at each build.
  for (const volunteer of day.volunteers) {
    const buildId = placement.get(volunteer.id);
    if (buildId === undefined) continue; // left out
    const build = builds.get(buildId);
    // Volunteers can only be placed at a build they chose.
    if (!build || !volunteer.buildIds.includes(buildId)) return null;

    if (volunteer.travel === "rider") build.riders += 1;
    if (volunteer.travel === "ownWay") build.ownWay += 1;
    if (volunteer.travel === "driver") build.drivers += 1;
    build.passengerSeats += passengerSeats(volunteer);
  }

  for (const build of builds.values()) {
    // Rule 2, rides: riders without a seat in a driver's car get one in a
    // car we're waiting for, whose driver's spot is held.
    build.heldDriverSpots = heldDriverSpots(build.riders, build.passengerSeats);
    // Rule 1, room: everyone placed there, plus the held spots, fits.
    if (placedAt(build) + build.heldDriverSpots > build.capacity) return null;
  }
  return builds;
}

// ─── Finding a plan ──────────────────────────────────────────────────────────

// What we ask the solver for:
//   "everyone": any plan that places every volunteer, if there is one.
//   "most":     a plan that places as many volunteers as possible.
//   "best":     as many as possible and, among those plans, the one that
//               holds the fewest spots for drivers (so the fewest drivers
//               still needed).
type Goal = "everyone" | "most" | "best";

type Search =
  | { outcome: "found"; placement: Placement; proven: boolean } // proven: no plan does better
  | { outcome: "impossible" } // only for "everyone": no plan places everyone
  | { outcome: "gave up" }; // ran out of time before finding a plan

// How long one search may take. A typical day takes under a millisecond;
// this only stops an unusually large day from tying up the server.
const DEFAULT_TIME_LIMIT_MS = 2000;

// Volunteers who travel the same way, chose the same builds and (for
// drivers) have the same size car are interchangeable as far as the rules
// go. So rather than deciding about each person, the solver decides how
// many from each group go to each build. That's much faster: it doesn't
// waste time trying to swap two people who are, for the rules, the same.
type Group = {
  travel: Travel;
  carSeats: number;
  buildIds: string[];
  memberIds: string[];
};

function groupInterchangeable(day: Day): Group[] {
  const offered = new Set(day.builds.map((build) => build.id));
  const groups = new Map<string, Group>();
  for (const volunteer of day.volunteers) {
    const buildIds = [...new Set(volunteer.buildIds)].filter((id) => offered.has(id)).sort();
    const carSeats = volunteer.travel === "driver" ? volunteer.carSeats : 0;
    const key = JSON.stringify([volunteer.travel, carSeats, buildIds]);
    const group = groups.get(key) ?? { travel: volunteer.travel, carSeats, buildIds, memberIds: [] };
    group.memberIds.push(volunteer.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// The solver's unknowns, all whole numbers of 0 or more:
//   place: how many volunteers from a group go to a build (one of theirs).
//   hold:  how many spots are held for drivers at a build.
type Unknown =
  | { kind: "place"; group: Group; buildId: string }
  | { kind: "hold"; buildId: string };

// Writes the rules as sums the solver can work with. Each rule is a
// "constraint": a named total that has to stay within a limit, with each
// unknown adding some amount per unit to that total.
function writeModel(day: Day, groups: Group[], goal: Goal): Model<Unknown, string> {
  const constraints = new Map<string, { max?: number; equal?: number }>();
  const unknowns: [Unknown, Record<string, number>][] = [];

  // For "best", placing one more volunteer has to beat any number of held
  // spots, so a placed volunteer scores more than the most spots a day can
  // hold (all of them, plus one).
  const totalSpots = day.builds.reduce((sum, build) => sum + build.capacity, 0);
  const placedScore = goal === "most" ? 1 : totalSpots + 1;
  const heldScore = goal === "best" ? -1 : 0;

  for (const build of day.builds) {
    // Rule 1, room: (volunteers placed here) + (held spots) ≤ spots.
    constraints.set(`room at ${build.id}`, { max: build.capacity });
    // Rule 2, rides: (riders here) − (drivers' passenger seats here)
    //                − 3 × (held spots) ≤ 0.
    // That is, every rider has a seat in a car, real or assumed.
    constraints.set(`rides at ${build.id}`, { max: 0 });

    // Each held spot takes a spot and brings an assumed car's seats.
    unknowns.push([
      { kind: "hold", buildId: build.id },
      {
        [`room at ${build.id}`]: 1,
        [`rides at ${build.id}`]: -PASSENGERS_PER_HELD_SPOT,
        score: heldScore,
      },
    ]);
  }

  groups.forEach((group, index) => {
    // Everyone in the group is placed ("everyone"), or at most everyone in
    // it ("most" and "best", which can leave people out).
    const size = group.memberIds.length;
    constraints.set(`group ${index}`, goal === "everyone" ? { equal: size } : { max: size });

    for (const buildId of group.buildIds) {
      // Each volunteer placed at a build counts once toward their group,
      // takes a spot there, and needs a seat (rider) or brings seats
      // (driver).
      const seats =
        group.travel === "rider" ? 1 : group.travel === "driver" ? -Math.max(0, group.carSeats - 1) : 0;
      unknowns.push([
        { kind: "place", group, buildId },
        {
          [`group ${index}`]: 1,
          [`room at ${buildId}`]: 1,
          [`rides at ${buildId}`]: seats,
          score: placedScore,
        },
      ]);
    }
  });

  return {
    direction: "maximize",
    // "everyone" just needs a plan that follows the rules, so it has nothing
    // to maximize, and the solver stops at the first plan it finds.
    objective: goal === "everyone" ? undefined : "score",
    constraints,
    variables: unknowns,
    integers: true, // every unknown is a whole number
  };
}

// Asks the solver for a plan, then double-checks it against the rules.
function search(day: Day, goal: Goal, timeLimitMs = DEFAULT_TIME_LIMIT_MS): Search {
  const groups = groupInterchangeable(day);
  // Someone with no builds left to choose from (their builds were all
  // cancelled) can't be placed anywhere.
  if (goal === "everyone" && groups.some((group) => group.buildIds.length === 0)) {
    return { outcome: "impossible" };
  }

  const solution = solve(writeModel(day, groups, goal), {
    timeout: timeLimitMs,
    maxIterations: Infinity, // limit by time instead
  });

  if (solution.status === "infeasible" && goal === "everyone") return { outcome: "impossible" };
  // "timedout" can still come with the best plan found so far.
  const finished = solution.status === "optimal";
  if (!finished && !(solution.status === "timedout" && !Number.isNaN(solution.result))) {
    return { outcome: "gave up" };
  }

  // Turn "how many from each group go where" back into people: hand out
  // each group's members in order.
  const placement: Placement = new Map();
  const handedOut = new Map<Group, number>();
  for (const [unknown, value] of solution.variables) {
    if (unknown.kind !== "place") continue;
    const start = handedOut.get(unknown.group) ?? 0;
    const count = Math.round(value);
    for (const id of unknown.group.memberIds.slice(start, start + count)) {
      placement.set(id, unknown.buildId);
    }
    handedOut.set(unknown.group, start + count);
  }

  // Never trust a plan that breaks a rule. (Held spots are worked out again
  // from the placement, so the solver's own count of them doesn't matter.)
  if (!checkPlacement(day, placement)) return { outcome: "gave up" };
  if (goal === "everyone" && placement.size < day.volunteers.length) return { outcome: "gave up" };
  return { outcome: "found", placement, proven: finished };
}

// ─── Can the day take another volunteer? ─────────────────────────────────────

// A volunteer who wants to sign up.
export type Newcomer = Omit<PlacementVolunteer, "id">;
const NEWCOMER_ID = "(newcomer)";

// Returns a check for whether the day can take one more volunteer. Results
// for the people already signed up are worked out once and reused, so
// checking several newcomers (or one at several builds) is cheap.
//
// Usually the answer is simply whether everyone, the newcomer included, can
// still be placed. But a day can end up short, with someone who can't be
// placed, through no fault of the rules: a driver cancels, an admin declines
// a pending driver, or a shift's spots are reduced. Nobody is ever removed
// automatically; admins see who's left out. On a short day, a newcomer is
// taken only if they don't leave more people out than before. So drivers
// (who can help) are still taken, and riders who'd make things worse aren't.
//
// If the solver runs out of time, the answer is no: we never take someone
// we can't confirm has a place.
export function signupChecker(day: Day) {
  let now: Search | undefined;
  let mostNow: Search | undefined;

  return function accepts(newcomer: Newcomer): boolean {
    const after: Day = {
      builds: day.builds,
      volunteers: [...day.volunteers, { ...newcomer, id: NEWCOMER_ID }],
    };

    // 1. Everyone, the newcomer included, can be placed: take them.
    const withThem = search(after, "everyone");
    if (withThem.outcome === "found") return true;
    if (withThem.outcome === "gave up") return false;

    // 2. Everyone could be placed without them, but not with them: they'd
    //    leave someone out (perhaps themselves). Turn them away.
    now ??= search(day, "everyone");
    if (now.outcome !== "impossible") return false;

    // 3. The day is already short. Take them only if one more person can be
    //    placed with them than the most that can be placed now, so nobody
    //    else is left out because of them.
    mostNow ??= search(day, "most");
    if (mostNow.outcome !== "found" || !mostNow.proven) return false;
    const mostWithThem = search(after, "most");
    return mostWithThem.outcome === "found" && mostWithThem.placement.size > mostNow.placement.size;
  };
}

// Works out, for each build (by ID), who it has room for: a newcomer who
// chose only that build. A newcomer who chooses several builds can sign up
// if any one of them has room for them.
//
// Each check builds on a simple fact: anyone who can do more fits wherever
// someone who can do less fits.
//   • An own-way volunteer fits wherever a rider fits: they take the
//     rider's spot and leave the seat free.
//   • A driver fits wherever an own-way volunteer fits, and brings seats.
//   • A bigger car fits wherever a smaller one does.
// So we only check further when the easier answer is no.
export function buildRoom(day: Day): Map<string, BuildRoom> {
  const accepts = signupChecker(day);
  const rooms = new Map<string, BuildRoom>();

  for (const build of day.builds) {
    const fits = (travel: Travel, carSeats = 0) =>
      accepts({ travel, carSeats, buildIds: [build.id] });

    if (fits("rider")) {
      rooms.set(build.id, { rider: true, ownWay: true, driverMinSeats: MIN_CAR_SEATS });
    } else if (fits("ownWay")) {
      rooms.set(build.id, { rider: false, ownWay: true, driverMinSeats: MIN_CAR_SEATS });
    } else if (!fits("driver", MAX_CAR_SEATS)) {
      rooms.set(build.id, { rider: false, ownWay: false, driverMinSeats: null });
    } else {
      // Only drivers fit, perhaps only with a big enough car. Find the
      // smallest car that fits by halving the range of sizes each time.
      let tooSmall = MIN_CAR_SEATS - 1; // largest size known not to fit
      let bigEnough = MAX_CAR_SEATS; // smallest size known to fit
      while (bigEnough - tooSmall > 1) {
        const middle = Math.floor((tooSmall + bigEnough) / 2);
        if (fits("driver", middle)) bigEnough = middle;
        else tooSmall = middle;
      }
      rooms.set(build.id, { rider: false, ownWay: false, driverMinSeats: bigEnough });
    }
  }
  return rooms;
}

// ─── A plan for admins ───────────────────────────────────────────────────────

export type DayPlan = {
  placement: Placement;
  // Volunteers who can't be placed (only on a short day).
  leftOut: string[];
  // What each build looks like, by build ID.
  builds: Map<string, BuildPlan>;
  // False if the solver ran out of time, so a better plan might exist.
  proven: boolean;
};

// A likely plan for the day, for admins: everyone placed if possible (or
// as many as possible), holding as few spots for drivers as possible. It
// isn't final; admins decide where people go.
export function planDay(day: Day, timeLimitMs = 1000): DayPlan {
  const plan = (placement: Placement, proven: boolean): DayPlan => ({
    placement,
    leftOut: day.volunteers.filter((v) => !placement.has(v.id)).map((v) => v.id),
    // A plan from search() always follows the rules, as does placing nobody.
    builds: checkPlacement(day, placement)!,
    proven,
  });

  const best = search(day, "best", timeLimitMs);
  if (best.outcome === "found") return plan(best.placement, best.proven);

  // Finding the very fewest held spots can take a while on a big day. If it
  // ran out of time, fall back to the quicker searches.
  for (const goal of ["everyone", "most"] as const) {
    const found = search(day, goal, timeLimitMs);
    if (found.outcome === "found") return plan(found.placement, false);
  }
  return plan(new Map(), false);
}
