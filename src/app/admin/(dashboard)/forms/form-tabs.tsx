"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { assignmentsTab } from "@/lib/signup-forms/attendance";

// The tabs on a signup form's admin pages: its overview, who signed up,
// who's on the waitlist (when the form has one, or anyone is still on it),
// and their assignments to builds: planned until the day's first build
// starts, then confirmed. The open tab comes from the address.
export function FormTabs({
  formId,
  confirming,
  volunteerCount,
  waitingCount,
  waitlist,
}: {
  formId: string;
  // The Assignments tab shows the confirmed assignments.
  confirming: boolean;
  volunteerCount: number;
  waitingCount: number;
  // The form lets volunteers join its waitlist.
  waitlist: boolean;
}) {
  const pathname = usePathname();
  const base = `/admin/forms/${formId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/volunteers`, label: `Volunteers (${volunteerCount})` },
    ...(waitlist || waitingCount > 0 ? [{ href: `${base}/waitlist`, label: `Waitlist (${waitingCount})` }] : []),
    { href: `${base}/assignments`, label: assignmentsTab(confirming) },
  ];
  const tab = "rounded-full px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-colors";

  return (
    <nav aria-label="Form" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
      {tabs.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            tab,
            pathname === href
              ? "bg-background text-foreground shadow-sm"
              : "hover-gold text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

