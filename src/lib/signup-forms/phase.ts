import type { FormStatus } from "@/generated/prisma/enums";

// Where a signup form is in its life, from its status and open and close
// times:
// - draft: only admins can see it.
// - not-open: published, so volunteers can see it, but they can't fill it
//   out until it opens.
// - open: volunteers can fill it out.
// - closed: past its close time.
// - cancelled: an admin cancelled the event. Volunteers can see that it's
//   off, and can't sign up or cancel.
export type FormPhase = "draft" | "not-open" | "open" | "closed" | "cancelled";

export function formPhase(
  form: { status: FormStatus; opensAt: Date; closesAt: Date },
  now = new Date(),
): FormPhase {
  if (form.status === "CANCELLED") return "cancelled";
  if (form.status === "DRAFT") return "draft";
  if (now >= form.closesAt) return "closed";
  if (now < form.opensAt) return "not-open";
  return "open";
}
