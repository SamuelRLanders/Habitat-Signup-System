import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Day, PlacementVolunteer, Travel } from "./solver";
import { takeFromWaitlist } from "./waitlist";

// Run with: npm test

const volunteer = (id: string, travel: Travel, buildIds: string[], carSeats = 0): PlacementVolunteer => ({
  id,
  travel,
  carSeats,
  buildIds,
});

describe("takeFromWaitlist", () => {
  it("takes people in the order they joined while there's room", () => {
    const day: Day = {
      builds: [{ id: "A", capacity: 3 }],
      volunteers: [volunteer("s1", "ownWay", ["A"])],
    };
    const waiting = [
      volunteer("w1", "ownWay", ["A"]),
      volunteer("w2", "ownWay", ["A"]),
      volunteer("w3", "ownWay", ["A"]),
    ];
    assert.deepEqual(takeFromWaitlist(day, waiting), ["w1", "w2"]);
  });

  it("takes nobody from a full day", () => {
    const day: Day = {
      builds: [{ id: "A", capacity: 1 }],
      volunteers: [volunteer("s1", "ownWay", ["A"])],
    };
    assert.deepEqual(takeFromWaitlist(day, [volunteer("w1", "ownWay", ["A"])]), []);
  });

  it("skips someone who still doesn't fit and tries the next person", () => {
    // One spot left at A, with no drivers: a rider would need a car (and a
    // held spot) of their own, but someone getting there on their own fits.
    const day: Day = {
      builds: [{ id: "A", capacity: 2 }],
      volunteers: [volunteer("s1", "ownWay", ["A"])],
    };
    const waiting = [volunteer("w1", "rider", ["A"]), volunteer("w2", "ownWay", ["A"])];
    assert.deepEqual(takeFromWaitlist(day, waiting), ["w2"]);
  });

  it("only takes people at builds they chose", () => {
    const day: Day = {
      builds: [
        { id: "A", capacity: 1 },
        { id: "B", capacity: 1 },
      ],
      volunteers: [volunteer("s1", "ownWay", ["A"])],
    };
    const waiting = [volunteer("w1", "ownWay", ["A"]), volunteer("w2", "ownWay", ["A", "B"])];
    assert.deepEqual(takeFromWaitlist(day, waiting), ["w2"]);
  });

  it("moves people already signed up to make room, as a signup would", () => {
    // s1 could go to A or B. Moving them to B frees A for w1.
    const day: Day = {
      builds: [
        { id: "A", capacity: 1 },
        { id: "B", capacity: 1 },
      ],
      volunteers: [volunteer("s1", "ownWay", ["A", "B"])],
    };
    assert.deepEqual(takeFromWaitlist(day, [volunteer("w1", "ownWay", ["A"])]), ["w1"]);
  });

  it("counts each person taken before trying the next", () => {
    // A driver taken first brings seats, so a rider after them fits too.
    const day: Day = {
      builds: [{ id: "A", capacity: 4 }],
      volunteers: [volunteer("s1", "ownWay", ["A"])],
    };
    const waiting = [volunteer("w1", "driver", ["A"], 4), volunteer("w2", "rider", ["A"])];
    assert.deepEqual(takeFromWaitlist(day, waiting), ["w1", "w2"]);
  });

  it("skips someone whose builds were all cancelled", () => {
    const day: Day = { builds: [{ id: "A", capacity: 5 }], volunteers: [] };
    assert.deepEqual(takeFromWaitlist(day, [volunteer("w1", "ownWay", [])]), []);
  });
});
