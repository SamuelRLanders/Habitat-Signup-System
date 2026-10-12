import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { buttonVariants } from "@/components/ui/button";

// For any address that isn't a page on this site.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          There&apos;s no page at this address. The link may have been
          mistyped, or the page may have moved.
        </p>
        <Link href="/" className={buttonVariants()}>
          See upcoming build days
        </Link>
      </main>
    </div>
  );
}
