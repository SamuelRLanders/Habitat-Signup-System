"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { MAX_BUILDS } from "@/lib/experience";
import { countBuilds } from "@/lib/form-signups/experience";
import type { FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, toDateInput } from "@/lib/time";

// Admins changing a volunteer's record from the People page. Every action
// calls requireAdmin() first, and treats the IDs it's sent as untrusted.

const buildsSchema = z.coerce
  .number("Enter a number of builds.")
  .int("Enter a whole number of builds.")
  .min(0, "Builds can't be less than 0.")
  .max(MAX_BUILDS, `Enter at most ${MAX_BUILDS} builds.`);

export type BuildsState = FormState<"builds">;

// Sets how many builds a volunteer has done, which decides how experienced
// they are. It's saved as the difference from the builds counted from
// their signups (src/lib/form-signups/experience.ts), so builds they go on
// later still add on.
export async function setBuilds(volunteerId: string, _prev: BuildsState, formData: FormData): Promise<BuildsState> {
  await requireAdmin();

  const raw = formData.get("builds");
  const parsed = buildsSchema.safeParse(typeof raw === "string" && raw.trim() !== "" ? raw : undefined);
  if (!parsed.success) return { errors: { builds: parsed.error.issues[0].message } };

  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);
  const current = (await countBuilds([volunteerId], today)).get(volunteerId);
  if (!current) return { errors: { form: "This volunteer no longer exists." } };

  const { count } = await prisma.volunteer.updateMany({
    where: { id: volunteerId },
    data: { buildsAdjustment: parsed.data - current.counted },
  });
  if (count === 0) return { errors: { form: "This volunteer no longer exists." } };

  revalidatePath("/admin", "layout");
  return { success: true };
}
