import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BuildStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import {
  createShifts,
  deleteBuild,
  removeShift,
  restoreShift,
  setBuildStatus,
  updateShift,
} from "@/lib/builds/actions";
import { getBuild } from "@/lib/builds/queries";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  formatTimeRange,
  timeZoneLabel,
  toDateInput,
  toTimeInput,
} from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { BackLink, SpotsMeter, StatusBadge } from "../build-parts";
import { ShareDialog } from "./share-dialog";
import { ShiftDialog } from "./shift-dialog";

export async function generateMetadata({
  params,
}: PageProps<"/admin/builds/[buildId]">): Promise<Metadata> {
  const { buildId } = await params;
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { name: true },
  });
  return { title: build?.name ?? "Build" };
}

const statusNotes: Record<BuildStatus, string> = {
  DRAFT: "Only admins can see this build. Publish it to open signups.",
  PUBLISHED: "Volunteers can see this build and sign up for its shifts.",
  CLOSED: "Volunteers can see this build but can't sign up.",
  CANCELLED: "This build was cancelled. Volunteers can't sign up.",
};

export default async function BuildPage({
  params,
}: PageProps<"/admin/builds/[buildId]">) {
  await requireAdmin();
  const { buildId } = await params;

  const build = await getBuild(buildId);
  if (!build) notFound();

  const now = new Date();
  const zone = build.timeZone;
  const zoneLabel = timeZoneLabel(zone);
  const cancelled = build.status === "CANCELLED";

  // Group shifts under a heading for each day.
  const days = Map.groupBy(build.shifts, (shift) =>
    toDateInput(shift.startsAt, zone),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/admin/builds">Back to builds</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{build.name}</h1>
              <StatusBadge status={build.status} />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(build.address)}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:underline"
            >
              {build.address}
            </a>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {build.status === "PUBLISHED" && (
              <ShareDialog path={`/builds/${build.id}`} />
            )}
            <Link
              href={`/admin/builds/${build.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit details
            </Link>
            <StatusActions buildId={build.id} status={build.status} />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{statusNotes[build.status]}</p>

        {build.description && (
          <p className="whitespace-pre-line">{build.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="shifts-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="shifts-heading" className="text-lg font-semibold">
              Shifts
            </h2>
            <p className="text-sm text-muted-foreground">
              Times are in {zoneLabel} time.
            </p>
          </div>
          {!cancelled && (
            <ShiftDialog
              action={createShifts.bind(null, build.id)}
              mode="add"
              title="Add shifts"
              submitLabel="Add shift"
              trigger={{ label: "Add shifts" }}
              timeZoneLabel={zoneLabel}
            />
          )}
        </div>

        {build.shifts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No shifts yet. Add shifts so volunteers have something to sign
              up for.
            </CardContent>
          </Card>
        ) : (
          [...days].map(([day, shifts]) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {formatDate(shifts[0].startsAt, zone)}
              </h3>
              <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
                {shifts.map((shift) => {
                  const isPast = shift.endsAt < now;
                  const isCancelled = shift.cancelledAt !== null;
                  const rosterHref = `/admin/builds/${build.id}/shifts/${shift.id}`;

                  return (
                    <li
                      key={shift.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4"
                    >
                      <div
                        className={`flex min-w-0 flex-1 flex-col gap-1 ${isCancelled || isPast ? "text-muted-foreground" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={rosterHref} className="font-medium hover:underline">
                            {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                          </Link>
                          {isCancelled && <Badge variant="destructive">Cancelled</Badge>}
                          {!isCancelled && isPast && <Badge variant="secondary">Past</Badge>}
                        </div>
                        {shift.notes && (
                          <p className="text-sm whitespace-pre-line">{shift.notes}</p>
                        )}
                      </div>

                      <SpotsMeter filled={shift.filled} capacity={shift.capacity} />

                      <div className="flex flex-wrap items-start gap-1">
                        <Link
                          href={rosterHref}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Volunteers
                        </Link>
                        {!cancelled && (
                          <ShiftDialog
                            action={updateShift.bind(null, shift.id)}
                            mode="edit"
                            title="Edit shift"
                            submitLabel="Save shift"
                            trigger={{ label: "Edit", variant: "ghost" }}
                            timeZoneLabel={zoneLabel}
                            filled={shift.filled}
                            defaults={{
                              date: toDateInput(shift.startsAt, zone),
                              startTime: toTimeInput(shift.startsAt, zone),
                              endTime: toTimeInput(shift.endsAt, zone),
                              capacity: String(shift.capacity),
                              notes: shift.notes ?? "",
                            }}
                          />
                        )}
                        {!cancelled &&
                          (isCancelled ? (
                            <ActionButton
                              action={restoreShift.bind(null, shift.id)}
                              label="Restore"
                              variant="ghost"
                            />
                          ) : (
                            <RemoveShiftButton
                              shiftId={shift.id}
                              signupCount={shift.signupCount}
                            />
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function StatusActions({ buildId, status }: { buildId: string; status: BuildStatus }) {
  const setStatus = (next: BuildStatus) => setBuildStatus.bind(null, buildId, next);
  const cancelBuild = (
    <ActionButton
      action={setStatus("CANCELLED")}
      label="Cancel build"
      variant="destructive"
      confirm={{
        title: "Cancel this build?",
        description:
          "Volunteers won't be able to sign up. Existing signups are kept on record, but volunteers aren't notified automatically yet.",
        confirmLabel: "Cancel build",
      }}
    />
  );

  switch (status) {
    case "DRAFT":
      return (
        <>
          <ActionButton
            action={deleteBuild.bind(null, buildId)}
            label="Delete"
            variant="ghost"
            confirm={{
              title: "Delete this build?",
              description: "The build and its shifts will be permanently deleted.",
              confirmLabel: "Delete build",
            }}
          />
          <ActionButton action={setStatus("PUBLISHED")} label="Publish" variant="default" />
        </>
      );
    case "PUBLISHED":
      return (
        <>
          <ActionButton action={setStatus("DRAFT")} label="Unpublish" />
          <ActionButton action={setStatus("CLOSED")} label="Close signups" />
          {cancelBuild}
        </>
      );
    case "CLOSED":
      return (
        <>
          <ActionButton action={setStatus("PUBLISHED")} label="Reopen signups" variant="default" />
          {cancelBuild}
        </>
      );
    case "CANCELLED":
      // Restored builds come back with signups closed, so the admin can
      // check everything before reopening.
      return <ActionButton action={setStatus("CLOSED")} label="Restore build" />;
  }
}

function RemoveShiftButton({
  shiftId,
  signupCount,
}: {
  shiftId: string;
  signupCount: number;
}) {
  const hasSignups = signupCount > 0;
  return (
    <ActionButton
      action={removeShift.bind(null, shiftId)}
      label={hasSignups ? "Cancel" : "Delete"}
      variant="ghost"
      confirm={
        hasSignups
          ? {
              title: "Cancel this shift?",
              description:
                "Volunteers have signed up, so the shift will be marked cancelled and kept on record. Volunteers aren't notified automatically yet.",
              confirmLabel: "Cancel shift",
            }
          : {
              title: "Delete this shift?",
              description: "Nobody has signed up, so the shift will be permanently deleted.",
              confirmLabel: "Delete shift",
            }
      }
    />
  );
}
