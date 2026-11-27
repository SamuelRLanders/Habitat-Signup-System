import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { cancelDeadline } from "@/lib/form-signups/queries";
import type { RosterSignup } from "@/lib/form-signups/rosters";
import { travelOf, travelRosterFor } from "@/lib/placement/load";
import { revertAssignments } from "@/lib/signup-forms/assignment-actions";
import { NO_SHOW } from "@/lib/signup-forms/attendance";
import { revertAttendance } from "@/lib/signup-forms/attendance-actions";
import { shiftTime } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/time";
import { seatsLabel } from "@/lib/volunteers";
import { formTitle, loadForm, loadFormPlan } from "../data";
import { AssignmentBoard, type BoardVolunteer } from "./assignment-board";
import { CopyRoster } from "./copy-roster";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]/assignments">): Promise<Metadata> {
  const { formId } = await params;
  const form = await loadForm(formId);
  return { title: await formTitle(formId, form?.confirming ? "Confirmed assignments" : "Planned assignments") };
}

// Where each volunteer is going (planned assignments) until the day's
// first build starts, then where they went (confirmed assignments).
//   - Planned: the app's placement until an admin saves custom
//     assignments, which they can change once the form has closed, or
//     revert. Before then it's what the app would do now.
//   - Confirmed: the planned assignments as they were when the first build
//     started (src/lib/data/final-placement.ts), which admins correct to
//     show who went where, with no-shows and people who came without
//     signing up, for the Data page. They can be changed for as long as
//     the event is kept, or reverted to the planned ones.
// Purdue's travel roster, from the saved assignments, can be copied either
// way.
export default async function AssignmentsPage({
  params,
}: PageProps<"/admin/forms/[formId]/assignments">) {
  const admin = await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, active, waiting, custom, plan } = loaded;
  const editor = canEdit(admin.role);
  const confirmed = form.confirming;
  // Nobody can be moved until the form has closed, or on a cancelled event.
  // Viewers see the board, but can't move anyone.
  const readOnly = !editor || form.status !== "PUBLISHED" || (!confirmed && form.phase !== "closed");
  const names = new Map(form.shifts.map((shift) => [shift.id, shift.name]));
  const allNames = new Map([...form.shifts, ...form.cancelledShifts].map((shift) => [shift.id, shift.name]));

  // Everyone signed up, then everyone waiting, in the order they joined.
  const volunteers: BoardVolunteer[] = [...active, ...waiting].map((signup) => {
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
      waiting: signup.waitlistedAt !== null,
      addedBy: signup.addedAt ? (signup.addedByName ?? "an admin") : null,
      planned:
        confirmed && signup.plannedShiftId
          ? { id: signup.plannedShiftId, name: allNames.get(signup.plannedShiftId) ?? "a cancelled build" }
          : null,
      travelLabel: !form.askTransportation
        ? null
        : travel === "driver"
          ? `Driver${signup.driver.status === "pending" ? " (pending)" : ""} · ${seatsLabel(carSeats)}`
          : travel === "rider"
            ? "Needs a ride"
            : "Own way",
    };
  });
  const initial = Object.fromEntries(
    active.map((signup) => [
      signup.id,
      confirmed && signup.noShow ? NO_SHOW : (plan.placement.get(signup.id) ?? null),
    ]),
  );
  const savedAt = (confirmed ? form.attendanceConfirmedAt : form.assignmentsSavedAt)?.toISOString() ?? null;
  const anyAdded = active.some((signup) => signup.addedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          {confirmed ? (
            <ConfirmedNote form={form} readOnly={readOnly} />
          ) : (
            <PlannedNote form={form} custom={custom} readOnly={readOnly} anyWaiting={waiting.length > 0} />
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {confirmed && (form.attendanceConfirmedAt || anyAdded) && (
              <ActionButton
                action={revertAttendance.bind(null, form.id)}
                label="Revert to planned"
                confirm={{
                  title: "Revert to the planned assignments?",
                  description:
                    "Everyone goes back to the build they were planned for when the first build started, no-shows are cleared, and people you added are taken off. Anyone moved from the waitlist stays signed up, in Not placed. This can't be undone.",
                  confirmLabel: "Revert",
                }}
              />
            )}
            {!confirmed && custom && (
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
        )}
      </div>

      <CopyRoster {...rosterFor(form, active, plan, custom)} />

      {/* A confirmed board shows even when empty, to add people who came. */}
      {volunteers.length === 0 && !confirmed ? (
        <p className="text-muted-foreground">Nobody signed up or joined the waitlist through this form.</p>
      ) : (
        <AssignmentBoard
          // Starts over from the saved assignments after each save or revert.
          key={`${confirmed ? "confirmed" : "planned"}-${savedAt ?? "unsaved"}`}
          formId={form.id}
          mode={confirmed ? "confirmed" : "planned"}
          builds={form.shifts.map((shift) => ({
            id: shift.id,
            name: shift.name,
            capacity: shift.capacity,
            time: shiftTime(shift),
          }))}
          volunteers={volunteers}
          initial={initial}
          savedAt={savedAt}
          askTransportation={form.askTransportation}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

type LoadedPlan = NonNullable<Awaited<ReturnType<typeof loadFormPlan>>>;

function PlannedNote({
  form,
  custom,
  readOnly,
  anyWaiting,
}: {
  form: LoadedPlan["form"];
  custom: boolean;
  readOnly: boolean;
  anyWaiting: boolean;
}) {
  const at = (date: Date) => formatDateTime(date, DEFAULT_TIME_ZONE);
  const start = cancelDeadline(form.day, form.shifts);
  const closed = form.phase === "closed";
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {custom ? <Badge>Custom</Badge> : <Badge variant="secondary">Default</Badge>}
        {custom
          ? `Saved by ${form.assignmentsSavedByName ?? "an admin"} on ${at(form.assignmentsSavedAt!)}.`
          : "Placed by the app, following the placement rules, then sending someone highly experienced to each build and keeping friends together where it can."}
      </p>
      <p className="text-sm text-muted-foreground">
        {form.phase === "cancelled"
          ? "The event was cancelled, so these can't be changed."
          : !closed
            ? "Nobody can be moved until the form closes. Until then, this is where the app would place everyone now, which changes as people sign up and cancel."
            : readOnly
              ? "The Overview, Copy emails and the travel roster follow these. As a viewer, you can't change them."
              : custom
                ? "The Overview, Copy emails and the travel roster follow these. Volunteers who cancel are taken off; nobody else moves."
                : "Move anyone and save to make custom assignments. The Overview, Copy emails and the travel roster will follow them."}
      </p>
      {form.phase !== "cancelled" && (
        <p className="text-sm text-muted-foreground">
          When the first build starts ({at(start)}), these become the confirmed assignments, for marking who actually
          went.
        </p>
      )}
      {anyWaiting && closed && !readOnly && (
        <p className="text-sm text-muted-foreground">
          To add someone from the waitlist, check with them first, then move them to a build and save. They aren&apos;t
          emailed.
        </p>
      )}
    </>
  );
}

function ConfirmedNote({ form, readOnly }: { form: LoadedPlan["form"]; readOnly: boolean }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {form.attendanceConfirmedAt
          ? `Last saved by ${form.attendanceConfirmedByName ?? "an admin"} on ${formatDateTime(form.attendanceConfirmedAt, DEFAULT_TIME_ZONE)}.`
          : form.assignmentsSavedAt
            ? `These are the custom assignments ${form.assignmentsSavedByName ?? "an admin"} saved before the first build—they haven't been modified since.`
            : "These are assignments made by the algorithm—they haven't been modified."}
      </p>
      <p className="text-sm text-muted-foreground">
        {readOnly
          ? "Who went where, for the Data page. As a viewer, you can't change them."
          : "Move people to show who actually went where, for the Data page: anyone who didn't come and didn't cancel goes in No-shows, and anyone who came without signing up can be added."}
      </p>
    </>
  );
}

// Purdue's travel roster from the saved assignments, with anything to check
// before sending it. No roster when nobody's at a build.
function rosterFor(form: LoadedPlan["form"], active: RosterSignup[], plan: LoadedPlan["plan"], custom: boolean) {
  if (plan.placement.size === 0) return { text: null, warnings: [] };
  const travel = travelRosterFor(form.day, form.shifts, active, plan.placement, form);
  const pendingDrivers = [...plan.pendingDrivers.values()].reduce((sum, n) => sum + n, 0);
  // No-shows aren't going anywhere, so they're not worth a warning.
  const leftOut = plan.leftOut.filter((signup) => !(form.confirming && signup.noShow));
  const warnings = [
    leftOut.length > 0 &&
      (custom || form.confirming
        ? `Not on the roster because they aren't at a build: ${names(leftOut)}.`
        : `Not on the roster because they can't be placed right now: ${names(leftOut)}.`),
    travel.withoutRide > 0 &&
      `${plural(travel.withoutRide, "rider doesn't", "riders don't")} have a driver yet (marked "No ride yet").`,
    pendingDrivers > 0 &&
      `${plural(pendingDrivers, "driver is", "drivers are")} still waiting for Purdue approval (marked "approval pending").`,
  ].filter((warning) => typeof warning === "string");
  return { text: travel.text, warnings };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const names = (signups: RosterSignup[]) =>
  signups.map((signup) => `${signup.firstName} ${signup.lastName}`).join(", ");
