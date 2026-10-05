import "server-only";
import { prisma } from "@/lib/prisma";
import { toDay } from "@/lib/time";
import { firstWordKey, nameKey, type PurdueDriver } from "./purdue-list";
import { currentApproval, driverToday } from "./status";

// Matching Purdue's approved driver list against our pending and approved
// drivers. A volunteer matches a row by email, or else by last name and the
// first word of their first name ("Ammar" matches "Ammar Hafiy Bin").
// Nothing here changes any data: an admin reviews the matches first.

export type ListMatch = {
  volunteerId: string;
  name: string;
  email: string;
  by: "email" | "name";
  // The last day Purdue has them approved through.
  until: string;
  // Approving someone pending, or extending an approval Purdue renewed.
  kind: "approve" | "extend";
  currentUntil: string | null;
};

export type ListCheck = {
  rowCount: number;
  matches: ListMatch[];
  // On the list, but their approval there has ended.
  expired: { name: string; until: string }[];
  // Matched by name to more than one person, or without a readable date.
  unclear: { name: string; reason: string }[];
  // Pending volunteers who aren't on the list yet.
  notFound: { name: string; email: string }[];
};

export async function matchPurdueList(list: PurdueDriver[]): Promise<ListCheck> {
  const today = driverToday();
  const volunteers = await prisma.volunteer.findMany({
    where: {
      OR: [{ driverRequestedAt: { not: null } }, { driverApprovals: { some: currentApproval(today) } }],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      driverRequestedAt: true,
      driverApprovals: {
        where: currentApproval(today),
        orderBy: { approvedUntil: "desc" },
        take: 1,
        select: { approvedUntil: true },
      },
    },
  });

  const byEmail = group(list.filter((row) => row.email), (row) => row.email!);
  const byName = group(list, (row) => `${nameKey(row.lastName)}|${firstWordKey(row.firstName)}`);

  const check: ListCheck = { rowCount: list.length, matches: [], expired: [], unclear: [], notFound: [] };
  for (const volunteer of volunteers) {
    const name = `${volunteer.firstName} ${volunteer.lastName}`;
    const pending = volunteer.driverRequestedAt !== null;
    const approval = volunteer.driverApprovals[0]?.approvedUntil;
    const currentUntil = approval ? toDay(approval) : null;

    let by: ListMatch["by"] = "email";
    let rows = byEmail.get(volunteer.email.toLowerCase());
    if (!rows) {
      by = "name";
      rows = byName.get(`${nameKey(volunteer.lastName)}|${firstWordKey(volunteer.firstName)}`);
      // Different emails under one name are different people.
      const emails = new Set(rows?.map((row) => row.email).filter(Boolean));
      if (rows && emails.size > 1) {
        check.unclear.push({ name, reason: `${rows.length} people with this name are on Purdue's list. Check by hand.` });
        continue;
      }
    }

    if (!rows) {
      if (pending) check.notFound.push({ name, email: volunteer.email });
      continue;
    }
    // Someone renewed shows up more than once; the latest date counts.
    const until = rows.map((row) => row.until).filter((day): day is string => day !== null).sort().at(-1);
    if (!until) {
      check.unclear.push({ name, reason: "On Purdue's list, but the expiration date couldn't be read." });
    } else if (until < today) {
      if (pending) check.expired.push({ name, until });
    } else if (pending) {
      check.matches.push({ volunteerId: volunteer.id, name, email: volunteer.email, by, until, kind: "approve", currentUntil });
    } else if (currentUntil && until > currentUntil) {
      check.matches.push({ volunteerId: volunteer.id, name, email: volunteer.email, by, until, kind: "extend", currentUntil });
    }
  }
  return check;
}

function group<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
