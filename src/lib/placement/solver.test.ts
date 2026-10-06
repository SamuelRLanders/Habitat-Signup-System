import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoom,
  checkPlacement,
  heldDriverSpots,
  planDay,
  signupChecker,
  type Day,
  type PlacementVolunteer,
  type Travel,
} from "./solver";

// Run with: npm test

let nextId = 0;
const volunteer = (travel: Travel, buildIds: string[], carSeats = 0): PlacementVolunteer => ({
  id: `v${nextId++}`,
  travel,
  carSeats,
  buildIds,
});
const riders = (count: number, buildIds: string[]) =>
  Array.from({ length: count }, () => volunteer("rider", buildIds));
const ownWay = (count: number, buildIds: string[]) =>
  Array.from({ length: count }, () => volunteer("ownWay", buildIds));

describe("held driver spots", () => {
  it("holds one spot per 3 riders without a seat", () => {
    assert.equal(heldDriverSpots(0, 0), 0);
    assert.equal(heldDriverSpots(1, 0), 1);
    assert.equal(heldDriverSpots(3, 0), 1);
    assert.equal(heldDriverSpots(4, 0), 2);
    assert.equal(heldDriverSpots(7, 2), 2);
    assert.equal(heldDriverSpots(2, 6), 0);
  });
});

describe("signupChecker", () => {
  it("moves volunteers along a chain to free a spot", () => {
    // From the max-flow write-up: A, B and C have 1 spot each. V1 could go
    // to A or B, V2 to B or C, V3 only to C.
    const day: Day = {
      builds: [
        { id: "A", capacity: 1 },
        { id: "B", capacity: 1 },
        { id: "C", capacity: 1 },
      ],
      volunteers: [volunteer("ownWay", ["A", "B"]), volunteer("ownWay", ["B", "C"]), volunteer("ownWay", ["C"])],
    };
    const accepts = signupChecker(day);
    // Every spot is taken, so nobody else fits anywhere.
    assert.equal(accepts({ travel: "ownWay", carSeats: 0, buildIds: ["A"] }), false);

    // With a second spot at C, V2 can move to C and V1 to B, freeing A.
    day.builds[2].capacity = 2;
    assert.equal(signupChecker(day)({ travel: "ownWay", carSeats: 0, buildIds: ["A"] }), true);
  });

  it("holds spots for drivers once riders need cars", () => {
    // 10 spots, 6 riders and 2 own-way volunteers: 2 spots are held for
    // drivers, so the build is full for everyone else.
    const day: Day = {
      builds: [{ id: "A", capacity: 10 }],
      volunteers: [...riders(6, ["A"]), ...ownWay(2, ["A"])],
    };
    const room = buildRoom(day).get("A")!;
    assert.equal(room.rider, false);
    assert.equal(room.ownWay, false);
    // A 3-seat car carries 2 riders, leaving 4 who need 2 more cars: 6 + 2
    // + 1 + 2 = 11. A 4-seat car carries 3, leaving 3 for 1 more car: 10.
    assert.equal(room.driverMinSeats, 4);

    // A driver with a 7-seat car covers all 6 riders, so nothing is held:
    // 9 of 10 spots. One more rider would need a car of their own (11), but
    // an own-way volunteer fits.
    day.volunteers.push(volunteer("driver", ["A"], 7));
    const after = buildRoom(day).get("A")!;
    assert.equal(after.rider, false);
    assert.equal(after.ownWay, true);
  });

  it("moves a driver to the build whose riders need them", () => {
    // The driver could go to either build. Riders who can only go to B fill
    // it once the driver is there.
    const day: Day = {
      builds: [
        { id: "A", capacity: 5 },
        { id: "B", capacity: 5 },
      ],
      volunteers: [volunteer("driver", ["A", "B"], 5), ...riders(3, ["B"])],
    };
    // Without the driver at B, 4 riders there would hold 2 spots (6 > 5).
    assert.equal(signupChecker(day)({ travel: "rider", carSeats: 0, buildIds: ["B"] }), true);

    const plan = planDay({ ...day, volunteers: [...day.volunteers, ...riders(1, ["B"])] });
    assert.deepEqual(plan.leftOut, []);
    assert.equal(plan.builds.get("B")!.drivers, 1);
    assert.equal(plan.builds.get("B")!.heldDriverSpots, 0);
  });

  it("on a short day, takes only signups that don't leave more people out", () => {
    // 8 spots: a driver with an 8-seat car and the 7 riders in it. Then
    // the driver cancels. The 7 riders would need 3 held spots (10 > 8), so
    // at most 6 riders (and 2 held spots) can be placed: one is left out.
    const day: Day = {
      builds: [{ id: "A", capacity: 8 }],
      volunteers: riders(7, ["A"]),
    };
    const plan = planDay(day);
    assert.equal(plan.leftOut.length, 1);
    assert.equal(plan.builds.get("A")!.heldDriverSpots, 2);

    const accepts = signupChecker(day);
    // An own-way volunteer would take a spot a rider needs.
    assert.equal(accepts({ travel: "ownWay", carSeats: 0, buildIds: ["A"] }), false);
    assert.equal(accepts({ travel: "rider", carSeats: 0, buildIds: ["A"] }), false);
    // A driver with a 4-seat car takes a held spot and brings 3 seats, so
    // one more person can be placed: driver + 6 riders + 1 held = 8.
    assert.equal(accepts({ travel: "driver", carSeats: 4, buildIds: ["A"] }), true);
  });

  it("never takes anyone at a build with no spots", () => {
    const day: Day = { builds: [{ id: "A", capacity: 0 }], volunteers: [] };
    assert.deepEqual(buildRoom(day).get("A"), { rider: false, ownWay: false, driverMinSeats: null });
  });
});

describe("planDay with friends who asked to be together", () => {
  const twoBuilds = [
    { id: "A", capacity: 4 },
    { id: "B", capacity: 4 },
  ];

  it("places a pair at the same build when there's room", () => {
    const [bob, alice] = [volunteer("ownWay", ["A", "B"]), volunteer("ownWay", ["B"])];
    const day: Day = {
      builds: twoBuilds,
      volunteers: [bob, ...ownWay(3, ["B"]), alice],
      together: [[bob.id, alice.id]],
    };
    // B has 4 spots for the 5 who chose it. Only Bob could go to A, so
    // keeping him with Alice would leave someone out: he goes to A.
    assert.equal(planDay(day).placement.get(bob.id), "A");

    // With a spot free at B, they're placed together there.
    day.builds = [{ id: "A", capacity: 4 }, { id: "B", capacity: 5 }];
    const plan = planDay(day);
    assert.equal(plan.placement.get(bob.id), "B");
    assert.equal(plan.placement.get(alice.id), "B");
  });

  it("keeps a group together across several requests", () => {
    const [bob, alice, carol] = [
      volunteer("ownWay", ["A", "B"]),
      volunteer("rider", ["A", "B"]),
      volunteer("driver", ["A", "B"], 4),
    ];
    const day: Day = {
      builds: twoBuilds,
      volunteers: [bob, alice, carol],
      together: [
        [bob.id, alice.id],
        [carol.id, bob.id],
      ],
    };
    const plan = planDay(day);
    const where = plan.placement.get(bob.id);
    assert.equal(plan.placement.get(alice.id), where);
    assert.equal(plan.placement.get(carol.id), where);
  });

  it("never holds more spots for drivers to keep a pair together", () => {
    // The driver's car can carry the 3 riders at A, or Dana at B. Keeping
    // the driver with Dana would leave A's riders without a car.
    const driver = volunteer("driver", ["A", "B"], 4);
    const dana = volunteer("ownWay", ["B"]);
    const day: Day = {
      builds: twoBuilds,
      volunteers: [driver, ...riders(3, ["A"]), dana],
      together: [[driver.id, dana.id]],
    };
    const plan = planDay(day);
    assert.equal(plan.placement.get(driver.id), "A");
    assert.equal(plan.builds.get("A")!.heldDriverSpots, 0);
  });

  it("never turns a signup away over a pair", () => {
    const [bob, alice] = [volunteer("ownWay", ["A"]), volunteer("ownWay", ["B"])];
    const day: Day = { builds: twoBuilds, volunteers: [bob, alice], together: [[bob.id, alice.id]] };
    assert.equal(signupChecker(day)({ travel: "ownWay", carSeats: 0, buildIds: ["A"] }), true);
    assert.deepEqual(planDay(day).leftOut, []);
  });
});

// ─── Compared with trying every placement ────────────────────────────────────

// Pairs (from day.together) placed at the same build.
function pairsTogether(day: Day, placement: Map<string, string>) {
  return (day.together ?? []).filter(
    ([a, b]) => placement.has(a) && placement.get(a) === placement.get(b),
  ).length;
}

// Tries every way of placing (or leaving out) each volunteer and returns the
// most that can be placed, then among those the fewest held spots, then the
// most pairs together.
function bruteForce(day: Day) {
  let best = { placed: -1, held: Infinity, together: -1 };
  const placement = new Map<string, string>();

  const tryFrom = (index: number) => {
    if (index === day.volunteers.length) {
      const builds = checkPlacement(day, placement);
      if (!builds) return;
      const held = [...builds.values()].reduce((sum, build) => sum + build.heldDriverSpots, 0);
      const together = pairsTogether(day, placement);
      const better =
        placement.size !== best.placed
          ? placement.size > best.placed
          : held !== best.held
            ? held < best.held
            : together > best.together;
      if (better) best = { placed: placement.size, held, together };
      return;
    }
    const { id, buildIds } = day.volunteers[index];
    tryFrom(index + 1); // left out
    for (const buildId of buildIds) {
      placement.set(id, buildId);
      tryFrom(index + 1);
      placement.delete(id);
    }
  };
  tryFrom(0);
  return best;
}

// A small random number generator (mulberry32) with a fixed seed, so
// failures can be repeated. Returns whole numbers from 0 up to below.
function random(seed: number) {
  return (below: number) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * below);
  };
}

function randomDay(next: (below: number) => number): Day {
  const buildCount = 1 + next(3);
  const builds = Array.from({ length: buildCount }, (_, i) => ({ id: `b${i}`, capacity: next(7) }));
  const volunteerCount = 1 + next(buildCount === 3 ? 7 : 9);
  const volunteers = Array.from({ length: volunteerCount }, () => {
    const travel = (["rider", "rider", "ownWay", "driver"] as const)[next(4)];
    const buildIds = builds.filter(() => next(5) < 2).map((b) => b.id);
    if (buildIds.length === 0) buildIds.push(builds[next(buildCount)].id);
    return volunteer(travel, buildIds, 3 + next(5));
  });
  // A few different pairs who asked to be together.
  const together = new Map<string, [string, string]>();
  for (let i = next(4); i > 0 && volunteerCount > 1; i--) {
    const a = next(volunteerCount);
    const b = (a + 1 + next(volunteerCount - 1)) % volunteerCount;
    const pair = [volunteers[Math.min(a, b)].id, volunteers[Math.max(a, b)].id] as [string, string];
    together.set(pair.join(), pair);
  }
  return { builds, volunteers, together: [...together.values()] };
}

describe("compared with trying every placement", () => {
  it("finds the best plan", () => {
    const next = random(1);
    for (let trial = 0; trial < 1500; trial++) {
      const day = randomDay(next);
      const expected = bruteForce(day);
      const plan = planDay(day);
      const held = [...plan.builds.values()].reduce((sum, build) => sum + build.heldDriverSpots, 0);
      assert.ok(plan.proven);
      assert.deepEqual(
        { placed: plan.placement.size, held, together: pairsTogether(day, plan.placement) },
        expected,
        `day ${JSON.stringify(day)}`,
      );
    }
  });

  it("takes a newcomer exactly when the rules allow", () => {
    const next = random(2);
    for (let trial = 0; trial < 1500; trial++) {
      const day = randomDay(next);
      const newcomer = volunteer(
        (["rider", "ownWay", "driver"] as const)[next(3)],
        day.builds.filter(() => next(2) === 0).map((b) => b.id),
        3 + next(5),
      );
      if (newcomer.buildIds.length === 0) newcomer.buildIds.push(day.builds[0].id);

      // A newcomer can be taken if, with them, no more people are left out
      // than before.
      const before = bruteForce(day);
      const after = bruteForce({ ...day, volunteers: [...day.volunteers, newcomer] });
      const expected = after.placed > before.placed;
      assert.equal(
        signupChecker(day)(newcomer),
        expected,
        `day ${JSON.stringify(day)}, newcomer ${JSON.stringify(newcomer)}`,
      );
    }
  });
});
