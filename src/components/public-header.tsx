import Link from "next/link";
import { SiteBrand } from "@/components/site-brand";
import { buttonVariants } from "@/components/ui/button";

// The header on the pages volunteers see, which don't need signing in.
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b-4 border-gold px-4 py-3">
      <SiteBrand href="/" label="Purdue Habitat Volunteering" />
      <Link
        href="/login"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Admin sign in
      </Link>
    </header>
  );
}
