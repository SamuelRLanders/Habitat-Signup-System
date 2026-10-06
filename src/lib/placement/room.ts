import type { Travel } from "./solver";

// Who a build has room for, from buildRoom() in ./solver.ts. Kept apart from
// the solver so the signup form can use it in the browser without loading
// the solver.

// Whether a build has room for one more volunteer, for each way of getting
// there.
export type BuildRoom = {
  rider: boolean;
  ownWay: boolean;
  // The fewest seats a new driver's car needs for them to be taken there
  // (from MIN_CAR_SEATS to MAX_CAR_SEATS), or null if no car would do.
  driverMinSeats: number | null;
};

// Whether a build has room for a newcomer who travels this way.
export function hasRoomFor(room: BuildRoom, travel: Travel, carSeats: number | null) {
  if (travel === "rider") return room.rider;
  if (travel === "ownWay") return room.ownWay;
  return room.driverMinSeats !== null && carSeats !== null && carSeats >= room.driverMinSeats;
}
