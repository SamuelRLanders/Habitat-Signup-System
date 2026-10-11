import type { BuildPlan, Placement } from "./solver";

// What a volunteer cancelling after the form closed does to the day's
// travel, for the email to the form's creator. No database code, so it can
// be tested (./cancellation.test.ts).

type Plan = { placement: Placement; builds: Map<string, BuildPlan> };

// What changed between the plan with the volunteer who cancelled (before)
// and without them (after), as sentences: riders at a build who no longer
// have a seat in a car there, and, with the app's placement (custom is
// false), everyone else it now moves or can't place. Custom assignments
// never move anyone else. Empty when nobody else is affected.
export function cancellationEffects({
  builds,
  volunteers,
  before,
  after,
  custom,
  askTransportation,
}: {
  builds: { id: string; name: string }[];
  // Everyone still signed up.
  volunteers: { id: string; name: string }[];
  before: Plan;
  after: Plan;
  custom: boolean;
  askTransportation: boolean;
}): string[] {
  const effects: string[] = [];
  const buildName = new Map(builds.map((build) => [build.id, build.name]));

  if (askTransportation) {
    const withoutSeat = (plan: Plan, buildId: string) => {
      const build = plan.builds.get(buildId);
      return build ? Math.max(0, build.riders - build.passengerSeats) : 0;
    };
    for (const build of builds) {
      const was = withoutSeat(before, build.id);
      const now = withoutSeat(after, build.id);
      if (now <= was) continue;
      const riders = after.builds.get(build.id)!.riders;
      const who = now - was === 1 ? "1 more rider doesn't" : `${now - was} more riders don't`;
      effects.push(
        `At ${build.name}, ${who} have a seat in a driver's car (${now} of ${plural(riders, "rider", "riders")} there without one now).`,
      );
    }
  }

  if (!custom) {
    const moved: string[] = [];
    const unplaced: string[] = [];
    for (const volunteer of volunteers) {
      const was = before.placement.get(volunteer.id);
      const now = after.placement.get(volunteer.id);
      if (was === now) continue;
      if (!now) unplaced.push(volunteer.name);
      else moved.push(`${volunteer.name} (${was ? `${buildName.get(was)} → ` : "now placed at "}${buildName.get(now)})`);
    }
    if (moved.length > 0) effects.push(`The app's placement now moves ${moved.join(", ")}.`);
    if (unplaced.length > 0) {
      effects.push(
        `The app can no longer place ${unplaced.join(", ")} at a build, so they're off the travel roster.`,
      );
    }
  }

  return effects;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
