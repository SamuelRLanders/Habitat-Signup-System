import type { Placement, Travel } from "./solver";

// The travel roster Purdue asks for before each build day: who's going to
// each build, who's driving, who rides with whom, and everyone's phone
// number. It follows a placement from the solver (./solver.ts), which only
// decides who goes to which build; here each build's riders are shared out
// among the cars of the drivers placed there.
//
//   10/24 General Travel Roster
//
//   Going to 940 Birch Rd, Lafayette, IN 47905
//   Frank Hale	765-555-0101 (Driver)
//   Mona Reyes	765-555-0102
//   Nate Cole	765-555-0103 (Approved driver)
//
//   Quinn Abbott	765-555-0104 (Own way)

export type RosterBuild = {
  id: string;
  address: string;
};

export type RosterVolunteer = {
  id: string;
  name: string;
  phone: string; // E.164, e.g. +17655550123
  travel: Travel;
  // Seats in a driver's car, counting the driver's.
  carSeats: number;
  // Purdue driver approval. Riders who are approved are noted, since they
  // could take over driving.
  driverStatus: "approved" | "pending" | "none";
};

// One car going to a build: its driver and the riders in it.
type Car = { driver: RosterVolunteer; riders: RosterVolunteer[] };

// Shares a build's riders out among its drivers' cars. Each rider gets the
// car with the most free seats, so riders are spread evenly rather than
// packed into the first car. Riders left over (when the cars are full, and
// spots are held for drivers who haven't signed up yet) have no ride yet.
export function fillCars(drivers: RosterVolunteer[], riders: RosterVolunteer[]) {
  const cars: Car[] = drivers.map((driver) => ({ driver, riders: [] }));
  const freeSeats = (car: Car) => Math.max(0, car.driver.carSeats - 1) - car.riders.length;
  const withoutRide: RosterVolunteer[] = [];

  for (const rider of riders) {
    let best: Car | undefined;
    for (const car of cars) {
      if (freeSeats(car) > 0 && (!best || freeSeats(car) > freeSeats(best))) best = car;
    }
    if (best) best.riders.push(rider);
    else withoutRide.push(rider);
  }
  return { cars, withoutRide };
}

// "765-555-0123"
function rosterPhone(phone: string) {
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
}

// The roster as text to paste into an email. day is "2026-10-24". Builds
// are listed in the order given, skipping ones nobody is placed at;
// volunteers who aren't placed are left off.
export function travelRoster({
  day,
  builds,
  volunteers,
  placement,
}: {
  day: string;
  builds: RosterBuild[];
  volunteers: RosterVolunteer[];
  placement: Placement;
}) {
  const [, month, date] = day.split("-").map(Number);
  const line = (volunteer: RosterVolunteer, note?: string) =>
    `${volunteer.name}\t${rosterPhone(volunteer.phone)}${note ? ` (${note})` : ""}`;

  const sections: string[] = [`${month}/${date} General Travel Roster`];
  let withoutRideCount = 0;

  for (const build of builds) {
    const here = volunteers.filter((volunteer) => placement.get(volunteer.id) === build.id);
    if (here.length === 0) continue;
    const ofType = (travel: Travel) => here.filter((volunteer) => volunteer.travel === travel);
    const { cars, withoutRide } = fillCars(ofType("driver"), ofType("rider"));
    withoutRideCount += withoutRide.length;

    // Each group is a car (driver first), then riders without a ride yet,
    // then volunteers getting there on their own, with a blank line between.
    const groups = [
      ...cars.map(({ driver, riders }) => [
        line(driver, driver.driverStatus === "pending" ? "Driver, approval pending" : "Driver"),
        ...riders.map((rider) => line(rider, rider.driverStatus === "approved" ? "Approved driver" : undefined)),
      ]),
      withoutRide.map((rider) => line(rider, "No ride yet")),
      ofType("ownWay").map((volunteer) => line(volunteer, "Own way")),
    ].filter((group) => group.length > 0);

    sections.push(`Going to ${build.address}\n` + groups.map((group) => group.join("\n")).join("\n\n"));
  }

  return { text: sections.join("\n\n") + "\n", withoutRide: withoutRideCount };
}
