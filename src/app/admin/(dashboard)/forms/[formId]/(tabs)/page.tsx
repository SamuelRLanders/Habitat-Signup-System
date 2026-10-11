import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { placedAt, type BuildPlan } from "@/lib/placement/solver";
import { assignmentsOpen } from "@/lib/signup-forms/phase";
import { shiftTime } from "@/lib/signup-forms/queries";
import { SpotsMeter } from "../../../admin-parts";
import { CopyEmailsButton } from "../../copy-emails-button";
import { formTitle, loadFormPlan } from "./data";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  return { title: await formTitle(formId) };
}

// A signup form's overview: its builds, how many volunteers could work at
// each, and who's going there.
export default async function SignupFormPage({
  params,
}: PageProps<"/admin/forms/[formId]">) {
  await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, active, custom, plan } = loaded;
  const { phase } = form;

  // The emails of the volunteers going to each shift (by ID), A–Z, for
  // emailing a build's volunteers once the form has closed and nobody new
  // can sign up.
  const placedEmails = new Map<string, string[]>();
  for (const signup of [...active].sort((a, b) => a.email.localeCompare(b.email))) {
    const shiftId = plan.placement.get(signup.id);
    if (shiftId) placedEmails.set(shiftId, [...(placedEmails.get(shiftId) ?? []), signup.email]);
  }
  // How many active signups chose each shift.
  const willing = new Map<string, number>();
  for (const signup of active) {
    for (const id of signup.shiftIds) willing.set(id, (willing.get(id) ?? 0) + 1);
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="sites-heading">
      <div>
        <h2 id="sites-heading" className="text-lg font-semibold">
          Builds
        </h2>
        <p className="text-sm text-muted-foreground">
          {custom
            ? `Volunteers say which builds they could work at. Each build shows the custom assignments saved by ${form.assignmentsSavedByName ?? "an admin"}; change them on the Assignments tab.`
            : assignmentsOpen(phase)
              ? "Volunteers say which builds they could work at. Each build shows the app's placement; change it on the Assignments tab."
              : "Volunteers say which builds they could work at. Each build shows a likely placement; it isn't final."}{" "}
          Once the form closes, copy a build&apos;s emails to write to the
          volunteers going there.
        </p>
      </div>

      {form.shifts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            No builds yet.{" "}
            <Link href={`/admin/forms/${form.id}/edit`} className="underline underline-offset-4">
              Edit the form
            </Link>{" "}
            to add the day&apos;s builds.
          </CardContent>
        </Card>
      ) : (
        form.shifts.map((shift) => (
          <div
            key={shift.id}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 hover-gold rounded-xl p-4 ring-1 ring-foreground/10"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="font-semibold">{shift.name}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{shiftTime(shift)}</span> ·{" "}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shift.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {shift.address}
                </a>
              </p>
              {shift.description && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {shift.description}
                </p>
              )}
              {shift.lunch && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  <span className="font-medium text-foreground">Lunch:</span> {shift.lunch}
                </p>
              )}
              <ShiftPlan
                custom={custom}
                build={plan.builds.get(shift.id)!}
                pendingDrivers={plan.pendingDrivers.get(shift.id) ?? 0}
              />
            </div>
            <div className="flex flex-col items-end gap-3">
              <SpotsMeter willing={willing.get(shift.id) ?? 0} capacity={shift.capacity} />
              {(phase === "closed" || phase === "passed") && placedEmails.has(shift.id) && (
                <CopyEmailsButton emails={placedEmails.get(shift.id)!} buildName={shift.name} />
              )}
            </div>
          </div>
        ))
      )}

      {form.cancelledShifts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Cancelled, so not offered: {form.cancelledShifts.map((shift) => shift.name).join(", ")}.
          Volunteers who chose them are kept, and count again if you restore
          one from Edit form.
        </p>
      )}
    </section>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// "Likely here: 4 need a ride · 1 driver, 4 seats for riders · 2 on their
// own · 1 highly experienced · 1 spot held for a driver", or "· nobody highly
// experienced" when no one with 6 or more builds is there.
// With custom assignments, which can break the rules, riders without a seat
// are shown instead of spots held for drivers.
function ShiftPlan({
  custom,
  build,
  pendingDrivers,
}: {
  custom: boolean;
  build: BuildPlan;
  pendingDrivers: number;
}) {
  if (placedAt(build) === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {custom ? "Nobody assigned here." : "Nobody placed here yet."}
      </p>
    );
  }
  const parts = [
    build.riders > 0 && `${build.riders} need${build.riders === 1 ? "s" : ""} a ride`,
    build.drivers > 0 &&
      `${plural(build.drivers, "driver", "drivers")}${pendingDrivers > 0 ? ` (${pendingDrivers} pending)` : ""}, ${plural(build.passengerSeats, "seat", "seats")} for riders`,
    build.ownWay > 0 && `${build.ownWay} on their own`,
    build.experienced > 0 && `${build.experienced} highly experienced`,
  ].filter(Boolean);

  return (
    <p className="text-sm text-muted-foreground">
      <span className="text-foreground">{custom ? "Assigned here" : "Likely here"}:</span> {parts.join(" · ")}
      {custom
        ? build.riders > build.passengerSeats && (
            <span className="font-medium text-destructive">
              {" "}
              · {build.riders - build.passengerSeats} without a seat in a car
            </span>
          )
        : build.heldDriverSpots > 0 && (
            <span className="font-medium text-foreground">
              {" "}
              · {plural(build.heldDriverSpots, "spot", "spots")} held for{" "}
              {build.heldDriverSpots === 1 ? "a driver" : "drivers"}
            </span>
          )}
      {build.experienced === 0 && (
        <span className="font-medium text-foreground"> · nobody highly experienced</span>
      )}
    </p>
  );
}
