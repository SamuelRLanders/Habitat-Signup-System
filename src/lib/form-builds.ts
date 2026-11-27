import * as z from "zod";
import { groupEmailSchema } from "@/lib/form-signups/details";
import { firstErrors } from "@/lib/forms";

// The builds on a signup form, as the form editor sends them: one of each
// field per build, in order. "buildId" is empty for a new build, and
// "buildCancelled" is "yes" for a build that's cancelled (one volunteers
// chose, which is kept rather than deleted). Times are on the form's day,
// in Indiana time. "buildReservations" is a JSON list of the spots reserved
// at the build, each for a named volunteer.

export const MAX_BUILDS = 30;
const MAX_SPOTS = 500;

// A volunteer a spot is reserved for: their Purdue email, and their name as
// the editor gave it.
const reservationSchema = z.object({
  email: groupEmailSchema,
  firstName: z.string().trim().min(1, "Enter their first name.").max(100, "Keep the name under 100 characters."),
  lastName: z.string().trim().min(1, "Enter their last name.").max(100, "Keep the name under 100 characters."),
});

export type ReservationInput = z.output<typeof reservationSchema>;

const reservationsSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      ctx.addIssue({ code: "custom", message: "The reserved spots couldn't be read. Refresh the page." });
      return z.NEVER;
    }
  })
  .pipe(z.array(reservationSchema, "The reserved spots couldn't be read. Refresh the page.").max(MAX_SPOTS));

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
      .max(MAX_SPOTS, `A build can have at most ${MAX_SPOTS} spots.`),
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
    // The admin responsible for organizing it. Whether they're an editor
    // or the owner is checked against the database when saving.
    responsibleId: z.string().trim().min(1, "Choose the admin responsible for this build.").max(64),
    reservations: reservationsSchema,
    cancelled: z.string().transform((value) => value === "yes"),
  })
  .refine((build) => build.endTime > build.startTime, {
    message: "The build must end after it starts.",
    path: ["endTime"],
  })
  // Reserved spots are some of the build's spots.
  .refine((build) => build.reservations.length <= build.capacity, {
    message: "A build can't have more reserved spots than volunteer spots.",
    path: ["reservations"],
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
  const responsible = field("buildResponsible");
  const reservations = field("buildReservations");
  const cancelled = field("buildCancelled");
  if (ids.length > MAX_BUILDS) {
    return { ok: false as const, form: `A form can have at most ${MAX_BUILDS} builds.` };
  }

  const builds: BuildInput[] = [];
  const errors: Record<number, BuildErrors> = {};
  // Volunteers tell builds apart by name, so each needs its own.
  const usedNames = new Set<string>();
  // A volunteer can only have one reserved spot on a form.
  const reserved = new Set<string>();
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
      responsibleId: responsible[index] ?? "",
      reservations: reservations[index] ?? "",
      cancelled: cancelled[index] ?? "",
    });
    if (!parsed.success) {
      errors[index] = firstErrors(parsed.error);
      return;
    }
    const name = parsed.data.name.toLowerCase();
    if (usedNames.has(name)) errors[index] = { name: "Another build on this form has this name." };
    usedNames.add(name);
    for (const reservation of parsed.data.reservations) {
      if (reserved.has(reservation.email)) {
        errors[index] = {
          ...errors[index],
          reservations: `${reservation.firstName} ${reservation.lastName} has more than one reserved spot on this form.`,
        };
      }
      reserved.add(reservation.email);
    }
    builds.push(parsed.data);
  });

  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  return { ok: true as const, builds };
}
