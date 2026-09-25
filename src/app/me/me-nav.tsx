"use client";

import { CalendarCheckIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const tabs = [
  { href: "/me", label: "Your signups", icon: CalendarCheckIcon },
  { href: "/me/profile", label: "Your details", icon: UserIcon },
];

export function MeNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Your pages" className="flex gap-1">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
              active
                ? "bg-muted text-foreground"
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
