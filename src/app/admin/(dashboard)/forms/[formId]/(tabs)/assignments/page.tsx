import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/dal";
import { travelOf } from "@/lib/placement/load";
import { revertAssignments } from "@/lib/signup-forms/assignment-actions";
import { assignmentsOpen } from "@/lib/signup-forms/phase";
import { shiftTime } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/time";
import { seatsLabel } from "@/lib/volunteers";
import { formTitle, loadFormPlan } from "../data";
import { AssignmentBoard, type BoardVolunteer } from "./assignment-board";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]/assignments">): Promise<Metadata> {
  const { formId } = await params;
  return { title: await formTitle(formId, "Assignments") };
}

// Where each volunteer is going, once the form has closed: the app's
// placement until an admin saves custom assignments, which they can change
// until the event day is over, or revert.
export default async function AssignmentsPage({
  params,
}: PageProps<"/admin/forms/[formId]/assignments">) {
  await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, active, custom, plan } = loaded;
  if (!assignmentsOpen(form.phase)) redirect(`/admin/forms/${form.id}`);
  const readOnly = form.phase === "passed";
  const names = new Map(form.shifts.map((shift) => [shift.id, shift.name]));

  const volunteers: BoardVolunteer[] = active.map((signup) => {
    const { travel, carSeats } = travelOf(
      signup.transportation,
      signup.carSeats,
      signup.driver.status !== "none",
      form.askTransportation,
    );
    return {
      id: signup.id,
      name: `${signup.firstName} ${signup.lastName}`,
      email: signup.email,
      travel,
      carSeats,
      buildIds: signup.shiftIds,
      chose: signup.shiftIds.flatMap((id) => names.get(id) ?? []),
      builds: signup.builds,
      travelLabel: !form.askTransportation
        ? null
        : travel === "driver"
          ? `Driver${signup.driver.status === "pending" ? " (pending)" : ""} · ${seatsLabel(carSeats)}`
          : travel === "rider"
            ? "Needs a ride"
            : "Own way",
    };
  });
  const savedAt = form.assignmentsSavedAt?.toISOString() ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {custom ? <Badge>Custom</Badge> : <Badge variant="secondary">Default</Badge>}
            {custom
              ? `Saved by ${form.assignmentsSavedByName ?? "an admin"} on ${formatDateTime(form.assignmentsSavedAt!, DEFAULT_TIME_ZONE)}.`
              : "Placed by the app, following the placement rules, then sending someone highly experienced to each build and keeping friends together where it can."}
          </p>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "The event day is over, so these are the final assignments."
              : custom
                ? "The Overview, Copy emails and the travel roster follow these. Volunteers who cancel are taken off; nobody else moves."
                : "Move anyone and save to make custom assignments. The Overview, Copy emails and the travel roster will follow them."}
          </p>
        </div>
        {custom && !readOnly && (
          <ActionButton
            action={revertAssignments.bind(null, form.id)}
            label="Revert to default"
            confirm={{
              title: "Revert to the app's assignments?",
              description:
                "Your custom assignments are replaced by the app's placement. This can't be undone. Volunteers aren't emailed.",
              confirmLabel: "Revert",
            }}
          />
        )}
      </div>

      {volunteers.length === 0 ? (
        <p className="text-muted-foreground">Nobody signed up through this form.</p>
      ) : (
        <AssignmentBoard
          // Starts over from the saved assignments after each save or revert.
          key={savedAt ?? "default"}
          formId={form.id}
          builds={form.shifts.map((shift) => ({
            id: shift.id,
            name: shift.name,
            capacity: shift.capacity,
            time: shiftTime(shift),
          }))}
          volunteers={volunteers}
          initial={Object.fromEntries(active.map((signup) => [signup.id, plan.placement.get(signup.id) ?? null]))}
          savedAt={savedAt}
          askTransportation={form.askTransportation}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
