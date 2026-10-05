import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
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
import { approveDriver, declineDriver, revokeDriver } from "@/lib/drivers/actions";
import { getDrivers } from "@/lib/drivers/queries";
import { formatPhone } from "@/lib/phone";
import { DEFAULT_TIME_ZONE, formatDate, formatDay, toDay } from "@/lib/time";
import { DRIVER_APPROVAL_URL, seatsLabel } from "@/lib/volunteers";
import { ApproveForm } from "./approve-form";
import { PurdueListCheck } from "./purdue-list-check";

export const metadata: Metadata = { title: "Drivers" };

// Purdue's list of approved drivers, with each approval's end date. It
// needs a Purdue sign-in, so admins download it themselves and upload it.
const PURDUE_APPROVED_DRIVERS_URL =
  "https://purdue0.sharepoint.com/sites/VehicleUseInfo/Documents/ApprovedDrivers.xlsx";

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  carSeats: number | null;
};

// Volunteers' Purdue driver approvals. Volunteers become pending when they
// say on a signup form that they filled out Purdue's driver approval form;
// an admin checks with Purdue, then approves them through a day or
// declines. Each decision keeps the admin's name.
export default async function DriversPage() {
  await requireAdmin();
  const { pending, approved, recentlyExpired } = await getDrivers();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Drivers</h1>
        <p className="text-sm text-muted-foreground">
          Volunteers ask to drive by filling out{" "}
          <a href={DRIVER_APPROVAL_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Purdue&apos;s driver approval form
          </a>{" "}
          and telling us on a signup form. Check them against Purdue&apos;s
          approved driver list, then record their approval here.
        </p>
      </div>

      <PurdueListCheck listUrl={PURDUE_APPROVED_DRIVERS_URL} />

      <Section title={`Pending approval (${pending.length})`} empty="Nobody is waiting for approval.">
        {pending.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <People />
                <TableHead>Asked</TableHead>
                <TableHead>Approve through</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((volunteer) => {
                const name = `${volunteer.firstName} ${volunteer.lastName}`;
                return (
                  <TableRow key={volunteer.id}>
                    <PersonCells person={volunteer} />
                    <TableCell className="whitespace-nowrap">
                      {formatDate(volunteer.driverRequestedAt!, DEFAULT_TIME_ZONE)}
                    </TableCell>
                    <TableCell>
                      <ApproveForm
                        action={approveDriver.bind(null, volunteer.id)}
                        suggestedUntil={volunteer.suggestedUntil}
                        name={name}
                      />
                    </TableCell>
                    <TableCell>
                      <ActionButton
                        action={declineDriver.bind(null, volunteer.id)}
                        label="Decline"
                        variant="ghost"
                        confirm={{
                          title: `Decline ${name}?`,
                          description:
                            "They won't be approved, and they'll be asked about the form again on their next signup. The decision is kept on record.",
                          confirmLabel: "Decline",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title={`Approved (${approved.length})`} empty="No approved drivers yet.">
        {approved.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <People />
                <TableHead>Approved through</TableHead>
                <TableHead>Approved by</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((approval) => {
                const { volunteer } = approval;
                return (
                  <TableRow key={approval.id}>
                    <PersonCells person={volunteer} />
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDay(toDay(approval.approvedUntil!), "short")}
                    </TableCell>
                    <TableCell>
                      {approval.decidedByName}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(approval.decidedAt, DEFAULT_TIME_ZONE)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActionButton
                        action={revokeDriver.bind(null, approval.id)}
                        label="Revoke"
                        variant="ghost"
                        confirm={{
                          title: `Revoke ${volunteer.firstName} ${volunteer.lastName}'s approval?`,
                          description:
                            "They'll no longer be an approved driver, and they'll be asked about the form again on their next signup. The approval is kept on record as revoked.",
                          confirmLabel: "Revoke",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      {recentlyExpired.length > 0 && (
        <Section title={`Recently expired (${recentlyExpired.length})`} empty="">
          <p className="text-sm text-muted-foreground">
            Approvals that ended in the last 90 days. These volunteers are asked
            to fill out the form again on their next signup.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <People />
                <TableHead>Ended</TableHead>
                <TableHead>Approved by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentlyExpired.map((approval) => (
                <TableRow key={approval.id}>
                  <PersonCells person={approval.volunteer} />
                  <TableCell className="whitespace-nowrap">
                    {formatDay(toDay(approval.approvedUntil!), "short")}
                  </TableCell>
                  <TableCell>{approval.decidedByName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? (
        <div className="hover-gold rounded-xl ring-1 ring-foreground/10">{children}</div>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">{empty}</CardContent>
        </Card>
      )}
    </section>
  );
}

function People() {
  return (
    <>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Phone</TableHead>
      <TableHead>Car</TableHead>
    </>
  );
}

function PersonCells({ person }: { person: Person }) {
  return (
    <>
      <TableCell className="font-medium">
        {person.firstName} {person.lastName}
      </TableCell>
      <TableCell>
        <a href={`mailto:${person.email}`} className="hover:underline">
          {person.email}
        </a>
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatPhone(person.phone)}</TableCell>
      <TableCell className="whitespace-nowrap">
        {person.carSeats === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          seatsLabel(person.carSeats)
        )}
      </TableCell>
    </>
  );
}
