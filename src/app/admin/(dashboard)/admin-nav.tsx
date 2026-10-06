"use client";

import { CarIcon, ClipboardListIcon, HammerIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const tabs = [
  { href: "/admin/forms", label: "Forms", icon: ClipboardListIcon },
  { href: "/admin/builds", label: "Projects", icon: HammerIcon },
  { href: "/admin/people", label: "People", icon: UsersIcon },
  { href: "/admin/drivers", label: "Drivers", icon: CarIcon },
];

// The admin sections. A tab stays highlighted on the pages beneath it, so
// "Projects" is active on /admin/builds/123/edit too.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex gap-1">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 hover-gold rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
              active
                ? "bg-gold text-black"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
