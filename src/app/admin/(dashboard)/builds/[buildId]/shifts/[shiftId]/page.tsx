import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { getShiftRoster } from "@/lib/builds/queries";
import { shiftLabel } from "@/lib/signup-forms/queries";
import { formatDate, formatTimeRange, timeZoneLabel } from "@/lib/time";
import { VolunteerTable } from "../../../../volunteer-table";
import { BackLink, SpotsMeter } from "../../../build-parts";

export const metadata: Metadata = { title: "Build volunteers" };

// The volunteers who said on the day's signup form that they could work
// this shift, with the other shifts that day they'd also work.
export default async function ShiftRosterPage({
  params,
}: PageProps<"/admin/builds/[buildId]/shifts/[shiftId]">) {
  await requireAdmin();
  const { buildId, shiftId } = await params;

  const shift = await getShiftRoster(buildId, shiftId);
  if (!shift) notFound();

  const zone = shift.build.timeZone;
  const labels = new Map(shift.dayShifts.map((s) => [s.id, shiftLabel(s)]));
  const offered = shift.dayShifts.some((s) => s.id === shift.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href={`/admin/builds/${shift.build.id}`}>Back to project</BackLink>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {formatDate(shift.startsAt, zone)}
              </h1>
              {shift.cancelledAt && <Badge variant="destructive">Cancelled</Badge>}
            </div>
            <p className="text-muted-foreground">
              {shift.build.name} · {formatTimeRange(shift.startsAt, shift.endsAt, zone)} (
              {timeZoneLabel(zone)} time)
            </p>
            <p className="text-sm">
              {shift.form ? (
                <Link href={`/admin/forms/${shift.form.id}`} className="hover:underline">
                  {shift.form.status === "DRAFT" ? "Signup form for this day (draft)" : "Signup form for this day"}
                </Link>
              ) : (
                <span className="text-muted-foreground">No signup form for this day yet.</span>
              )}
            </p>
          </div>
          <SpotsMeter willing={shift.volunteers.length} capacity={shift.capacity} className="w-48" />
        </div>

        {shift.notes && <p className="whitespace-pre-line">{shift.notes}</p>}
        {!offered && (
          <p className="text-sm text-muted-foreground">
            This build isn&apos;t offered on the signup form, because it or its
            project is cancelled. Volunteers who chose it are still listed.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="willing-heading">
        <h2 id="willing-heading" className="text-lg font-semibold">
          Could work at this build ({shift.volunteers.length})
        </h2>
        {shift.volunteers.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No volunteers have chosen this build yet.
            </CardContent>
          </Card>
        ) : (
          <VolunteerTable
            day={shift.day}
            shiftsHeading="Could also work at"
            rows={shift.volunteers.map((volunteer) => ({
              ...volunteer,
              // Other shifts still offered that day.
              shifts: volunteer.otherShiftIds.flatMap((id) => labels.get(id) ?? []),
            }))}
          />
        )}
      </section>
    </div>
  );
}
