import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
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
import { formatDate, formatDateTime, formatTimeRange, timeZoneLabel } from "@/lib/time";
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
  const columns = showStatus ? 6 : 5;

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
          {signups.map((signup) => {
            const { user, registration } = signup;
            const isGroup = registration.size > 1;
            const members = registration.groupMembers;
            return (
              <Fragment key={signup.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    {user.name || user.email}
                    {isGroup && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {registration.groupName
                          ? `Leader of ${registration.groupName}`
                          : "Group leader"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${user.email}`} className="hover:underline">
                      {user.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Phone phone={user.profile?.phone ?? null} texts={user.profile?.smsOptIn} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{registration.size}</TableCell>
                  <TableCell>{formatDate(signup.createdAt, timeZone)}</TableCell>
                  {showStatus && (
                    <TableCell>
                      {signup.status === "WAITLISTED" ? "Waitlisted" : "Cancelled"}
                    </TableCell>
                  )}
                </TableRow>
                {isGroup && !showStatus && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns} className="bg-muted/30 py-2 pl-8 text-xs text-muted-foreground">
                      {members.length} group {members.length === 1 ? "member has" : "members have"}{" "}
                      signed the waiver through the group link
                      {members.length > 0 && ":"}
                    </TableCell>
                  </TableRow>
                )}
                {!showStatus &&
                  members.map((member) => (
                    <TableRow key={member.id} className="bg-muted/30">
                      <TableCell className="pl-8">{member.legalName}</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>
                        <Phone phone={member.phone} texts={member.smsOptIn} />
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-muted-foreground">
                        Signed {formatDateTime(member.createdAt, timeZone)}
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// A phone number, with a note if they've agreed to texts.
function Phone({ phone, texts }: { phone: string | null; texts?: boolean }) {
  if (!phone) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap">
      {formatPhone(phone)}
      {texts && (
        <span className="block text-xs text-muted-foreground">Texts OK</span>
      )}
    </span>
  );
}
