import type { Transportation, TShirtSize } from "@/generated/prisma/enums";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone } from "@/lib/phone";
import { DEFAULT_TIME_ZONE, formatDate, formatDay } from "@/lib/time";
import {
  ageOn,
  seatsLabel,
  shirtLabel,
  TRANSPORTATION_SHORT,
  type DriverStatus,
} from "@/lib/volunteers";

export type VolunteerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  tShirtSize: TShirtSize;
  hasDriversLicense: boolean;
  transportation: Transportation | null;
  carSeats: number | null;
  driver: DriverStatus;
  createdAt: Date;
  // Shifts to list for them, such as "Maple Street Home, 8:00 AM – 12:00 PM".
  shifts: string[];
};

// Volunteers who signed up for a build day, with the details from their
// signup. Ages are on the build day.
export function VolunteerTable({
  rows,
  day,
  shiftsHeading,
}: {
  rows: VolunteerRow[];
  day: string;
  shiftsHeading: string;
}) {
  return (
    <div className="hover-gold rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead>T-shirt</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Getting there</TableHead>
            <TableHead>{shiftsHeading}</TableHead>
            <TableHead>Signed up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.firstName} {row.lastName}
              </TableCell>
              <TableCell>
                <a href={`mailto:${row.email}`} className="hover:underline">
                  {row.email}
                </a>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatPhone(row.phone)}</TableCell>
              <TableCell className="text-right tabular-nums">{ageOn(row.dateOfBirth, day)}</TableCell>
              <TableCell>{shirtLabel(row.tShirtSize)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <DriverCell license={row.hasDriversLicense} driver={row.driver} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.transportation ? (
                  <>
                    {TRANSPORTATION_SHORT[row.transportation]}
                    {row.transportation === "CAN_DRIVE" && row.carSeats !== null && (
                      <span className="block text-xs text-muted-foreground">
                        {seatsLabel(row.carSeats)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {row.shifts.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {row.shifts.map((shift) => (
                      <li key={shift} className="whitespace-nowrap">
                        {shift}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.createdAt, DEFAULT_TIME_ZONE)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// "Approved through Oct 5, 2027", "Pending", "Not approved" (has a license)
// or "No license".
function DriverCell({ license, driver }: { license: boolean; driver: DriverStatus }) {
  if (driver.status === "approved") {
    return (
      <>
        Approved
        <span className="block text-xs text-muted-foreground">
          through {formatDay(driver.until, "short")}
        </span>
      </>
    );
  }
  if (driver.status === "pending") return <>Pending</>;
  return <span className="text-muted-foreground">{license ? "Not approved" : "No license"}</span>;
}
