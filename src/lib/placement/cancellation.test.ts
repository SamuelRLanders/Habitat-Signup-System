import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cancellationEffects } from "./cancellation";
import type { BuildPlan } from "./solver";

// Run with: npm test

const builds = [
  { id: "ash", name: "Ash" },
  { id: "pine", name: "Pine" },
];
const volunteers = ["Xena", "Yuri", "Zack"].map((name) => ({ id: name, name }));
const build = (riders: number, passengerSeats: number): BuildPlan => ({
  capacity: 10,
  riders,
  ownWay: 0,
  drivers: 0,
  passengerSeats,
  heldDriverSpots: 0,
  experienced: 0,
});
const plan = (placement: Record<string, string>, ash: BuildPlan, pine: BuildPlan) => ({
  placement: new Map(Object.entries(placement)),
  builds: new Map([
    ["ash", ash],
    ["pine", pine],
  ]),
});

describe("cancellationEffects", () => {
  it("has nothing to say when nobody else is affected", () => {
    const before = plan({ Xena: "ash", Yuri: "pine" }, build(1, 3), build(0, 0));
    const after = plan({ Xena: "ash", Yuri: "pine" }, build(1, 3), build(0, 0));
    assert.deepEqual(
      cancellationEffects({ builds, volunteers, before, after, custom: false, askTransportation: true }),
      [],
    );
  });

  it("warns about riders left without a seat when a driver cancels", () => {
    const before = plan({ Xena: "ash", Yuri: "ash" }, build(2, 3), build(0, 0));
    const after = plan({ Xena: "ash", Yuri: "ash" }, build(2, 0), build(0, 0));
    assert.deepEqual(
      cancellationEffects({ builds, volunteers, before, after, custom: true, askTransportation: true }),
      ["At Ash, 2 more riders don't have a seat in a driver's car (2 of 2 riders there without one now)."],
    );
    // Nobody's asked how they're getting there.
    assert.deepEqual(
      cancellationEffects({ builds, volunteers, before, after, custom: true, askTransportation: false }),
      [],
    );
  });

  it("lists who the app's placement moves or can't place, but not with custom assignments", () => {
    const before = plan({ Xena: "ash", Yuri: "ash", Zack: "pine" }, build(0, 0), build(0, 0));
    const after = plan({ Xena: "pine", Zack: "pine" }, build(0, 0), build(0, 0));
    assert.deepEqual(
      cancellationEffects({ builds, volunteers, before, after, custom: false, askTransportation: true }),
      [
        "The app's placement now moves Xena (Ash → Pine).",
        "The app can no longer place Yuri at a build, so they're off the travel roster.",
      ],
    );
    assert.deepEqual(
      cancellationEffects({ builds, volunteers, before, after, custom: true, askTransportation: true }),
      [],
    );
  });
});
