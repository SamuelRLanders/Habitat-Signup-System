// How experienced a volunteer is, from how many builds they've been on (see
// buildsDone() in ./form-signups/experience.ts). The placement tries to send
// someone highly experienced to every build (src/lib/placement/solver.ts).
// No database code, so the browser can use it too.

export type Experience = "none" | "low" | "moderate" | "high";

// Most experienced first.
export const EXPERIENCE_LEVELS: Experience[] = ["high", "moderate", "low", "none"];

// The fewest builds for each level, most first.
const LEVELS: { level: Experience; from: number }[] = [
  { level: "high", from: 6 },
  { level: "moderate", from: 3 },
  { level: "low", from: 1 },
  { level: "none", from: 0 },
];

export function experienceOf(builds: number): Experience {
  return LEVELS.find(({ from }) => builds >= from)!.level;
}

// Whether the placement counts them as highly experienced.
export function isHighlyExperienced(builds: number) {
  return experienceOf(builds) === "high";
}

// The most builds an admin can enter for a volunteer: a typo guard, not a
// rule.
export const MAX_BUILDS = 200;

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: "New",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

// "High · 7 builds", "New · no builds"
export function experienceLabel(builds: number) {
  const count = builds === 0 ? "no builds" : `${builds} ${builds === 1 ? "build" : "builds"}`;
  return `${EXPERIENCE_LABELS[experienceOf(builds)]} · ${count}`;
}
