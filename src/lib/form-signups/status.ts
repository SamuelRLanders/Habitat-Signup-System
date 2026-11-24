import type { Prisma } from "@/generated/prisma/client";

// Which of a form's signups count, for queries. A signup is one of:
//   - signed up: placed by the app (or assigned by admins) at a build;
//   - waiting: on the waitlist for the builds they chose, which were all
//     full for them (FormSignup.waitlistedAt);
//   - cancelled, whether they were signed up or waiting.
// Only signed-up volunteers count towards spots, rosters, emails and the
// builds they've done. A waiting volunteer still has their one signup for
// the day.

export const SIGNED_UP = { cancelledAt: null, waitlistedAt: null } satisfies Prisma.FormSignupWhereInput;

export const WAITING = {
  cancelledAt: null,
  waitlistedAt: { not: null },
} satisfies Prisma.FormSignupWhereInput;
