import { HouseIcon } from "lucide-react";
import Link from "next/link";

// The site name in the page headers, with a gold house mark.
export function SiteBrand({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-lg bg-gold text-black">
        <HouseIcon aria-hidden="true" className="size-4" />
      </span>
      {label}
    </Link>
  );
}
