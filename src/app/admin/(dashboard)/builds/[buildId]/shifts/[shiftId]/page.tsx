import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/dal";
import { getShiftRoster } from "@/lib/builds/queries";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTimeRange, timeZoneLabel } from "@/lib/time";
import { BackLink, SpotsMeter } from "../../../build-parts";

export const metadata: Metadata = { title: "Shift volunteers" };

type Roster = NonNullable<Awaited<ReturnType<typeof getShiftRoster>>>;

export default async function ShiftRosterPage({
  params,
}: PageProps<"/admin/builds/[buildId]/shifts/[shiftId]">) {
  await requireAdmin();
  const { buildId, shiftId } = await params;

  const shift = await getShiftRoster(buildId, shiftId);
  if (!shift) notFound();

  const zone = shift.build.timeZone;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href={`/admin/builds/${shift.build.id}`}>Back to build</BackLink>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {formatDate(shift.startsAt, zone)}
              </h1>
              {shift.cancelledAt && <Badge variant="destructive">Cancelled</Badge>}
            </div>
            <p className="text-muted-foreground">
              {formatTimeRange(shift.startsAt, shift.endsAt, zone)} (
              {timeZoneLabel(zone)} time) · {shift.build.address}
            </p>
          </div>
          <SpotsMeter filled={shift.filled} capacity={shift.capacity} className="w-48" />
        </div>

        {shift.notes && <p className="whitespace-pre-line">{shift.notes}</p>}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="signed-up-heading">
        <h2 id="signed-up-heading" className="text-lg font-semibold">
          Signed up ({shift.confirmed.length})
        </h2>
        {shift.confirmed.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Nobody has signed up for this shift yet.
            </CardContent>
          </Card>
        ) : (
          <SignupTable signups={shift.confirmed} timeZone={zone} />
        )}
      </section>

      {shift.other.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="other-heading">
          <h2 id="other-heading" className="text-lg font-semibold">
            Cancelled or waitlisted ({shift.other.length})
          </h2>
          <SignupTable signups={shift.other} timeZone={zone} showStatus />
        </section>
      )}
    </div>
  );
}

function SignupTable({
  signups,
  timeZone,
  showStatus,
}: {
  signups: Roster["signups"];
  timeZone: string;
  showStatus?: boolean;
}) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Spots</TableHead>
            <TableHead>Signed up</TableHead>
            {showStatus && <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {signups.map((signup) => (
            <TableRow key={signup.id}>
              <TableCell className="font-medium">
                {signup.volunteer.firstName} {signup.volunteer.lastName}
                {signup.groupName && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {signup.groupName}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <a href={`mailto:${signup.volunteer.email}`} className="hover:underline">
                  {signup.volunteer.email}
                </a>
              </TableCell>
              <TableCell>{formatPhone(signup.volunteer.phone) || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{signup.groupSize}</TableCell>
              <TableCell>{formatDate(signup.createdAt, timeZone)}</TableCell>
              {showStatus && (
                <TableCell>
                  {signup.status === "WAITLISTED" ? "Waitlisted" : "Cancelled"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
