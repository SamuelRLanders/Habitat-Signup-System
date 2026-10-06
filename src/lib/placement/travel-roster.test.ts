import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Travel } from "./solver";
import { fillCars, travelRoster, type RosterVolunteer } from "./travel-roster";

// Run with: npm test

let nextPhone = 1000;
const person = (
  name: string,
  travel: Travel,
  extra: Partial<RosterVolunteer> = {},
): RosterVolunteer => ({
  id: name,
  name,
  phone: `+1765555${nextPhone++}`,
  travel,
  carSeats: 0,
  driverStatus: "none",
  ...extra,
});

describe("fillCars", () => {
  it("spreads riders across cars and leaves the rest without a ride", () => {
    const big = person("Big", "driver", { carSeats: 5 }); // 4 passengers
    const small = person("Small", "driver", { carSeats: 3 }); // 2 passengers
    const riders = ["A", "B", "C", "D", "E", "F", "G"].map((name) => person(name, "rider"));
    const { cars, withoutRide } = fillCars([big, small], riders);
    assert.deepEqual(
      cars.map((car) => car.riders.map((rider) => rider.name)),
      // Each rider takes the car with the most free seats (the first on a tie).
      [["A", "B", "C", "E"], ["D", "F"]],
    );
    assert.deepEqual(withoutRide.map((rider) => rider.name), ["G"]);
  });

  it("puts friends in the same car without leaving anyone else without a ride", () => {
    const big = person("Big", "driver", { carSeats: 4 }); // 3 passengers
    const small = person("Small", "driver", { carSeats: 3 }); // 2 passengers
    const riders = ["A", "B", "C", "D", "E", "F"].map((name) => person(name, "rider"));
    const { cars, withoutRide } = fillCars([big, small], riders, [
      ["E", "Small"], // E rides with Small
      ["B", "D"], // B and D (and F, through D) ride together
      ["F", "D"],
    ]);
    assert.deepEqual(
      cars.map((car) => car.riders.map((rider) => rider.name)),
      [["B", "D", "F"], ["E", "A"]],
    );
    assert.deepEqual(withoutRide.map((rider) => rider.name), ["C"]);
  });
});

describe("travelRoster", () => {
  it("lists each build's cars, riders without a ride and own-way volunteers", () => {
    nextPhone = 1000;
    const volunteers = [
      person("Frank Hale", "driver", { carSeats: 3, driverStatus: "approved" }),
      person("Mona Reyes", "rider"),
      person("Nate Cole", "rider", { driverStatus: "approved" }),
      person("Opal Shah", "rider"),
      person("Quinn Abbott", "ownWay"),
      person("Grace Moss", "driver", { carSeats: 7, driverStatus: "pending" }),
      person("Left Out", "rider"),
    ];
    const placement = new Map([
      ["Frank Hale", "birch"],
      ["Mona Reyes", "birch"],
      ["Nate Cole", "birch"],
      ["Opal Shah", "birch"],
      ["Quinn Abbott", "birch"],
      ["Grace Moss", "maple"],
    ]);
    const { text, withoutRide } = travelRoster({
      day: "2026-10-24",
      builds: [
        { id: "maple", address: "412 Maple St" },
        { id: "willow", address: "15 Willow Park Dr" },
        { id: "birch", address: "940 Birch Rd" },
      ],
      volunteers,
      placement,
    });
    assert.equal(withoutRide, 1);
    assert.equal(
      text,
      [
        "10/24 General Travel Roster",
        "",
        "Going to 412 Maple St",
        "Grace Moss\t765-555-1005 (Driver, approval pending)",
        "",
        "Going to 940 Birch Rd",
        "Frank Hale\t765-555-1000 (Driver)",
        "Mona Reyes\t765-555-1001",
        "Nate Cole\t765-555-1002 (Approved driver)",
        "",
        "Opal Shah\t765-555-1003 (No ride yet)",
        "",
        "Quinn Abbott\t765-555-1004 (Own way)",
        "",
      ].join("\n"),
    );
  });
});
