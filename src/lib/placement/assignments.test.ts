import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignmentWarnings, buildCounts, type AssignmentVolunteer } from "./assignments";

// Run with: npm test

const builds = [
  { id: "ash", name: "Ash", capacity: 3 },
  { id: "pine", name: "Pine", capacity: 2 },
];
const person = (
  id: string,
  travel: AssignmentVolunteer["travel"],
  buildIds: string[],
  carSeats = 0,
): AssignmentVolunteer => ({ id, name: id, travel, carSeats, buildIds });

describe("buildCounts", () => {
  it("counts people, riders and drivers' passenger seats", () => {
    const volunteers = [person("Wade", "driver", ["ash"], 4), person("Xena", "rider", ["ash"]), person("Ana", "ownWay", ["pine"])];
    assert.deepEqual(buildCounts("ash", volunteers, { Wade: "ash", Xena: "ash", Ana: "pine" }), {
      people: 2,
      riders: 1,
      seats: 3,
    });
  });
});

describe("assignmentWarnings", () => {
  it("has nothing to say about assignments that follow the rules", () => {
    const volunteers = [person("Wade", "driver", ["ash"], 4), person("Xena", "rider", ["ash"]), person("Ana", "ownWay", ["pine"])];
    assert.deepEqual(assignmentWarnings(builds, volunteers, { Wade: "ash", Xena: "ash", Ana: "pine" }, true), []);
  });

  it("warns about full builds, riders without seats, unchosen builds and people left out", () => {
    const volunteers = [
      person("Xena", "rider", ["pine"]),
      person("Yuri", "rider", ["pine"]),
      person("Zack", "rider", ["ash"]),
      person("Ana", "ownWay", ["ash"]),
    ];
    assert.deepEqual(assignmentWarnings(builds, volunteers, { Xena: "pine", Yuri: "pine", Zack: "pine", Ana: null }, true), [
      "Pine has 3 people for 2 spots.",
      "Pine: 3 of 3 riders don't have a seat in a driver's car there.",
      "At Pine, Zack didn't say they could work there.",
      "Not placed at any build: Ana. They won't be on any build's emails or the travel roster.",
    ]);
  });

  it("doesn't check rides on a form that doesn't ask how volunteers are getting there", () => {
    const volunteers = [person("Xena", "rider", ["ash"])];
    assert.deepEqual(assignmentWarnings(builds, volunteers, { Xena: "ash" }, false), []);
    assert.deepEqual(assignmentWarnings(builds, volunteers, { Xena: "ash" }, true), [
      "Ash: 1 rider doesn't have a seat in a driver's car there.",
    ]);
  });
});
