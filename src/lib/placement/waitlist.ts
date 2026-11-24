import { signupChecker, type Day, type PlacementVolunteer } from "./solver";

// Who comes off a waitlist when room opens up (src/lib/form-signups/
// waitlist.ts has the database side). No database code, so it can be
// tested (./waitlist.test.ts).

// Goes through the people waiting, in the order they joined, taking each
// one the day can now take at a build they chose, exactly as if they'd
// signed up then (signupChecker in ./solver.ts). Someone who still
// doesn't fit keeps their place, and the next person is tried, so a later
// person can be taken ahead of them: for example, an own-way volunteer
// where only a rider was ahead of them and riders still don't fit. Returns
// the IDs of those taken, in order.
export function takeFromWaitlist(day: Day, waiting: PlacementVolunteer[]): string[] {
  let current = day;
  let accepts = signupChecker(current);
  const taken: string[] = [];
  for (const volunteer of waiting) {
    // Every build they chose was cancelled: there's nowhere to take them.
    if (volunteer.buildIds.length === 0) continue;
    if (!accepts(volunteer)) continue;
    current = { ...current, volunteers: [...current.volunteers, volunteer] };
    accepts = signupChecker(current);
    taken.push(volunteer.id);
  }
  return taken;
}
