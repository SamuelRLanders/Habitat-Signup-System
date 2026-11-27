// The confirmed assignments: where everyone went, once the day's first
// build has started (see SignupForm.placementSavedAt). Shared by the
// Assignments tab and its actions (./attendance-actions.ts).

// Where admins put someone who didn't come and didn't cancel, as a value in
// the confirmed assignments they save (signup ID → build ID, NO_SHOW, or
// null for not at any build).
export const NO_SHOW = "no-show";

export type Attendance = Record<string, string | null>;

// A volunteer an admin could add to an event's confirmed assignments.
export type AddCandidate = {
  id: string;
  name: string;
  email: string;
  // Why they can't be added, or null.
  blocked: string | null;
  // Something to know first, such as that they cancelled.
  note: string | null;
};

export type AddCandidates = { matches: AddCandidate[]; more: boolean };

// The Assignments tab's name: planned until the day's first build starts,
// then confirmed.
export function assignmentsTab(confirming: boolean) {
  return confirming ? "Confirmed assignments" : "Planned assignments";
}
