import type { Travel } from "./solver";

// Admins' custom assignments: once a form closes, admins can move
// volunteers between its builds, or out of every build, in place of the
// app's placement (./solver.ts). Anything goes, but before saving they're
// warned about anything that breaks the placement rules. No database code,
// so the assignments page can check in the browser (./assignments.test.ts).

export type AssignmentBuild = { id: string; name: string; capacity: number };

export type AssignmentVolunteer = {
  id: string;
  name: string;
  travel: Travel;
  // Seats in a driver's car, counting the driver's. 0 for anyone else.
  carSeats: number;
  // The builds they said they could work at.
  buildIds: string[];
};

// Volunteer ID → the build they're assigned to, or null if not placed.
export type Assignments = Record<string, string | null>;

// Who's at a build: everyone, the riders, and the seats for riders in the
// cars of the drivers there.
export function buildCounts(buildId: string, volunteers: AssignmentVolunteer[], assignments: Assignments) {
  const here = volunteers.filter((volunteer) => assignments[volunteer.id] === buildId);
  return {
    people: here.length,
    riders: here.filter((volunteer) => volunteer.travel === "rider").length,
    seats: here.reduce(
      (sum, volunteer) => sum + (volunteer.travel === "driver" ? Math.max(0, volunteer.carSeats - 1) : 0),
      0,
    ),
  };
}

// What to check before saving, as sentences: builds with more people than
// spots, riders without a seat in a car at their build (when the form asks
// how volunteers are getting there), volunteers at a build they didn't
// choose, and volunteers who aren't placed.
export function assignmentWarnings(
  builds: AssignmentBuild[],
  volunteers: AssignmentVolunteer[],
  assignments: Assignments,
  askTransportation: boolean,
): string[] {
  const warnings: string[] = [];
  const names = (list: AssignmentVolunteer[]) => list.map((volunteer) => volunteer.name).join(", ");

  for (const build of builds) {
    const { people, riders, seats } = buildCounts(build.id, volunteers, assignments);
    if (people > build.capacity) {
      warnings.push(`${build.name} has ${people} people for ${plural(build.capacity, "spot", "spots")}.`);
    }
    if (askTransportation && riders > seats) {
      const without = riders - seats;
      const who = riders === 1 ? "1 rider" : `${without} of ${riders} riders`;
      warnings.push(
        `${build.name}: ${who} ${without === 1 ? "doesn't" : "don't"} have a seat in a driver's car there.`,
      );
    }
    const unchosen = volunteers.filter(
      (volunteer) => assignments[volunteer.id] === build.id && !volunteer.buildIds.includes(build.id),
    );
    if (unchosen.length > 0) {
      warnings.push(`At ${build.name}, ${names(unchosen)} didn't say they could work there.`);
    }
  }

  const unplaced = volunteers.filter((volunteer) => !assignments[volunteer.id]);
  if (unplaced.length > 0) {
    warnings.push(
      `Not placed at any build: ${names(unplaced)}. They won't be on any build's emails or the travel roster.`,
    );
  }
  return warnings;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
