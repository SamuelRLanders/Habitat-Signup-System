"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { assignmentsOpen, type AdminPhase } from "@/lib/signup-forms/phase";

// The tabs on a signup form's admin pages: its overview, who signed up,
// their assignments to builds (locked until the form closes), and Purdue's
// travel roster. The open tab comes from the address.
export function FormTabs({
  formId,
  phase,
  volunteerCount,
}: {
  formId: string;
  phase: AdminPhase;
  volunteerCount: number;
}) {
  const pathname = usePathname();
  const base = `/admin/forms/${formId}`;
  const locked = !assignmentsOpen(phase);
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/volunteers`, label: `Volunteers (${volunteerCount})` },
    { href: `${base}/assignments`, label: "Assignments", locked },
    { href: `${base}/travel-roster`, label: "Travel roster" },
  ];
  const tab = "rounded-full px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Form" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {tabs.map(({ href, label, locked }) =>
          locked ? (
            <span
              key={href}
              aria-disabled="true"
              title="Opens once the form closes"
              className={cn(tab, "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/60")}
            >
              <LockIcon className="size-3.5" aria-hidden="true" />
              {label}
            </span>
          ) : (
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
          ),
        )}
      </nav>
      {locked && phase !== "cancelled" && (
        <span className="text-sm text-muted-foreground">Assignments open once the form closes.</span>
      )}
    </div>
  );
}
