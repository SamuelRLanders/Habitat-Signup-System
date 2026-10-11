import type { FormStatus } from "@/generated/prisma/enums";
import { DEFAULT_TIME_ZONE, toDateInput, toDay } from "@/lib/time";

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

// What admins see: a closed form whose event day is over (in Indiana) has
// passed. Volunteers see it as closed.
export type AdminPhase = FormPhase | "passed";

export function adminPhase(
  form: Parameters<typeof formPhase>[0] & { date: Date },
  now = new Date(),
): AdminPhase {
  const phase = formPhase(form, now);
  if (phase === "closed" && toDay(form.date) < toDateInput(now, DEFAULT_TIME_ZONE)) return "passed";
  return phase;
}

// Whether admins can open a form's assignments: once it has closed, so
// nobody new can sign up. After the event day they're read-only.
export function assignmentsOpen(phase: AdminPhase) {
  return phase === "closed" || phase === "passed";
}
