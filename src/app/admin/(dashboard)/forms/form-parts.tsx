import { Badge } from "@/components/ui/badge";
import type { AdminPhase } from "@/lib/signup-forms/phase";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/time";

const phaseBadges = {
  draft: { label: "Draft", variant: "secondary" },
  "not-open": { label: "Not open yet", variant: "outline" },
  open: { label: "Open", variant: "default" },
  closed: { label: "Closed", variant: "secondary" },
  passed: { label: "Passed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
} as const;

export function PhaseBadge({ phase }: { phase: AdminPhase }) {
  const { label, variant } = phaseBadges[phase];
  return <Badge variant={variant}>{label}</Badge>;
}

// "Opens Oct 5, 2026, 9:00 AM", and so on, in Indiana time.
export function phaseNote(
  phase: AdminPhase,
  form: { opensAt: Date; closesAt: Date; cancelledAt: Date | null; cancelledByName: string | null },
) {
  const at = (date: Date) => formatDateTime(date, DEFAULT_TIME_ZONE);
  switch (phase) {
    case "draft":
      return `Only admins can see this form. Open ${at(form.opensAt)} – ${at(form.closesAt)} once published.`;
    case "not-open":
      return `Volunteers can see this form. Opens ${at(form.opensAt)}, closes ${at(form.closesAt)}.`;
    case "open":
      return `Volunteers can sign up until ${at(form.closesAt)}.`;
    case "closed":
      return `Closed ${at(form.closesAt)}.`;
    case "passed":
      return `Closed ${at(form.closesAt)}. The event day is over.`;
    case "cancelled":
      return `Event cancelled${form.cancelledByName ? ` by ${form.cancelledByName}` : ""}${form.cancelledAt ? ` on ${at(form.cancelledAt)}` : ""}. Volunteers signed up then were emailed.`;
  }
}
