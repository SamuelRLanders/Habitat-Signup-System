"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const tabs = [
  { href: "/admin/data/statistics", label: "Statistics" },
  { href: "/admin/data/people", label: "People" },
  { href: "/admin/data/builds", label: "Builds" },
];

// The Data page's tabs, drawn like a signup form's. The open tab comes from
// the address.
export function DataTabs() {
  const pathname = usePathname();
  const tab = "rounded-full px-3.5 py-1 text-sm font-medium whitespace-nowrap transition-colors";
  return (
    <nav aria-label="Data" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
      {tabs.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              tab,
              active
                ? "bg-background text-foreground shadow-sm"
                : "hover-gold text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
