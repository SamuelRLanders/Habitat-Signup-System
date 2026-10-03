import type { FormStatus } from "@/generated/prisma/enums";

// Where a signup form is in its life, from its status and open and close
// times:
// - draft: only admins can see it.
// - not-open: published, so volunteers can see it, but they can't fill it
//   out until it opens.
// - open: volunteers can fill it out.
// - closed: past its close time.
export type FormPhase = "draft" | "not-open" | "open" | "closed";

export function formPhase(
  form: { status: FormStatus; opensAt: Date; closesAt: Date },
  now = new Date(),
): FormPhase {
  if (form.status === "DRAFT") return "draft";
  if (now >= form.closesAt) return "closed";
  if (now < form.opensAt) return "not-open";
  return "open";
}
