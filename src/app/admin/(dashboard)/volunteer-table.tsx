import { cn } from "cn";
import type { Transportation, TShirtSize } from "@/generated/prisma/enums";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EXPERIENCE_LABELS, experienceOf } from "@/lib/experience";
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
  // How many builds they'd been on before this day.
  builds: number;
  // Builds to list for them, such as "Maple Street Home".
  shifts: string[];
  // Friends they asked to be placed with, or who asked for them, such as
  // { label: "Alice Smith", note: "together" }. The column only shows when
  // someone has one.
  friends?: { label: string; note: string }[];
};

// Volunteers who signed up for a build day, with the details from their
// signup. Ages are on the build day. Brief leaves out ages and when they
// signed up. Scrollable fills the space it's given and scrolls inside it,
// keeping the header in view, as in a popup. Travel shows how they're
// getting there; it's left out for a form that doesn't ask.
export function VolunteerTable({
  rows,
  day,
  shiftsHeading,
  brief = false,
  scrollable = false,
  travel = true,
}: {
  rows: VolunteerRow[];
  day: string;
  shiftsHeading: string;
  brief?: boolean;
  scrollable?: boolean;
  travel?: boolean;
}) {
  const showFriends = rows.some((row) => row.friends && row.friends.length > 0);
  return (
    <div
      className={cn(
        "hover-gold rounded-xl ring-1 ring-foreground/10",
        scrollable && "flex min-h-0 flex-col overflow-hidden",
      )}
    >
      <Table containerClassName={cn(scrollable && "min-h-0 flex-1 overflow-auto")}>
        <TableHeader
          className={cn(
            // The row's border scrolls away with a sticky header, so each
            // heading draws it as a shadow.
            scrollable &&
              "sticky top-0 z-10 [&_th]:bg-popover [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0",
          )}
        >
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            {!brief && <TableHead className="text-right">Age</TableHead>}
            <TableHead>T-shirt</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Experience</TableHead>
            {travel && <TableHead>Getting there</TableHead>}
            <TableHead>{shiftsHeading}</TableHead>
            {showFriends && <TableHead>Friends</TableHead>}
            {!brief && <TableHead>Signed up</TableHead>}
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
              {!brief && (
                <TableCell className="text-right tabular-nums">{ageOn(row.dateOfBirth, day)}</TableCell>
              )}
              <TableCell>{shirtLabel(row.tShirtSize)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <DriverCell license={row.hasDriversLicense} driver={row.driver} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <ExperienceCell builds={row.builds} />
              </TableCell>
              {travel && (
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
              )}
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
              {showFriends && (
                <TableCell className="text-sm">
                  {row.friends?.length ? (
                    <ul className="flex flex-col gap-0.5">
                      {row.friends.map((friend) => (
                        <li key={friend.label} className="whitespace-nowrap">
                          {friend.label}{" "}
                          <span className="text-xs text-muted-foreground">· {friend.note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              {!brief && (
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.createdAt, DEFAULT_TIME_ZONE)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// "High" over "7 builds", or "New" over "No builds".
function ExperienceCell({ builds }: { builds: number }) {
  const level = experienceOf(builds);
  return (
    <>
      <span className={cn(level === "high" && "font-medium")}>{EXPERIENCE_LABELS[level]}</span>
      <span className="block text-xs text-muted-foreground">
        {builds === 0 ? "No builds" : `${builds} ${builds === 1 ? "build" : "builds"}`}
      </span>
    </>
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
