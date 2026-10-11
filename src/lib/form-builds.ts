import * as z from "zod";
import { firstErrors } from "@/lib/forms";

// The builds on a signup form, as the form editor sends them: one of each
// field per build, in order. "buildId" is empty for a new build, and
// "buildCancelled" is "yes" for a build that's cancelled (one volunteers
// chose, which is kept rather than deleted). Times are on the form's day,
// in Indiana time.

export const MAX_BUILDS = 30;

const buildSchema = z
  .object({
    id: z.string().trim().max(64).transform((value) => value || null),
    name: z.string().trim().min(1, "Enter a name.").max(120, "Keep the name under 120 characters."),
    address: z.string().trim().min(1, "Enter an address.").max(300, "Keep the address under 300 characters."),
    startTime: z.iso.time({ precision: -1, error: "Choose a start time." }),
    endTime: z.iso.time({ precision: -1, error: "Choose an end time." }),
    capacity: z.coerce
      .number<string>("Enter the number of spots.")
      .int("Enter a whole number.")
      .min(1, "A build needs at least 1 spot.")
      .max(500, "A build can have at most 500 spots."),
    description: z
      .string()
      .trim()
      .max(5000, "Keep the description under 5,000 characters.")
      .transform((value) => value || null),
    lunch: z
      .string()
      .trim()
      .max(1000, "Keep the lunch note under 1,000 characters.")
      .transform((value) => value || null),
    cancelled: z.string().transform((value) => value === "yes"),
  })
  .refine((build) => build.endTime > build.startTime, {
    message: "The build must end after it starts.",
    path: ["endTime"],
  });

export type BuildInput = z.output<typeof buildSchema>;
export type BuildErrors = Partial<Record<Exclude<keyof BuildInput, "id" | "cancelled">, string>>;

// The builds, or the problems with each, by their position in the form.
export function parseBuilds(formData: FormData) {
  const field = (name: string) => formData.getAll(name).map(String);
  const ids = field("buildId");
  const names = field("buildName");
  const addresses = field("buildAddress");
  const starts = field("buildStart");
  const ends = field("buildEnd");
  const spots = field("buildSpots");
  const descriptions = field("buildDescription");
  const lunches = field("buildLunch");
  const cancelled = field("buildCancelled");
  if (ids.length > MAX_BUILDS) {
    return { ok: false as const, form: `A form can have at most ${MAX_BUILDS} builds.` };
  }

  const builds: BuildInput[] = [];
  const errors: Record<number, BuildErrors> = {};
  // Volunteers tell builds apart by name, so each needs its own.
  const usedNames = new Set<string>();
  ids.forEach((id, index) => {
    const parsed = buildSchema.safeParse({
      id,
      name: names[index] ?? "",
      address: addresses[index] ?? "",
      startTime: starts[index] ?? "",
      endTime: ends[index] ?? "",
      capacity: spots[index] ?? "",
      description: descriptions[index] ?? "",
      lunch: lunches[index] ?? "",
      cancelled: cancelled[index] ?? "",
    });
    if (!parsed.success) {
      errors[index] = firstErrors(parsed.error);
      return;
    }
    const name = parsed.data.name.toLowerCase();
    if (usedNames.has(name)) errors[index] = { name: "Another build on this form has this name." };
    usedNames.add(name);
    builds.push(parsed.data);
  });

  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  return { ok: true as const, builds };
}
