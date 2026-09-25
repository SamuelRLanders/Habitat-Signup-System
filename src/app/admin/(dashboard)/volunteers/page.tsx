import type { Metadata } from "next";
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
import { listVolunteers } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPhone } from "@/lib/phone";
import { DEFAULT_TIME_ZONE, formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Volunteers" };

// Everyone with an account. Group members who only signed a waiver through
// a group link don't have accounts, so they appear on shift rosters instead.
export default async function VolunteersPage() {
  await requireAdmin();
  const volunteers = await listVolunteers();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Volunteers ({volunteers.length})</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who has signed in. Group members who signed a waiver through
          a group link are listed on each shift&apos;s volunteer list.
        </p>
      </div>

      {volunteers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nobody has signed in yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Upcoming shifts</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map((volunteer) => (
                <TableRow key={volunteer.id}>
                  <TableCell className="font-medium">
                    <span className="flex flex-wrap items-center gap-2">
                      {volunteer.name || (
                        <span className="font-normal text-muted-foreground">
                          No details yet
                        </span>
                      )}
                      {volunteer.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${volunteer.email}`} className="hover:underline">
                      {volunteer.email}
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {volunteer.profile ? (
                      <>
                        {formatPhone(volunteer.profile.phone)}
                        {volunteer.profile.smsOptIn && (
                          <span className="block text-xs text-muted-foreground">Texts OK</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {volunteer.upcomingShifts}
                  </TableCell>
                  <TableCell>
                    {formatDate(volunteer.createdAt, DEFAULT_TIME_ZONE)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
