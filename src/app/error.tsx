"use client"; // Error boundaries must be Client Components.

import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { Button, buttonVariants } from "@/components/ui/button";

// Shown in place of any page that fails to load. In production, error
// doesn't say what went wrong (so nothing private leaks), but its digest
// matches the error in the server logs, so it's shown as a reference.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">
          This page didn&apos;t load. Try again in a moment. If it keeps
          happening, let the Purdue Habitat organizers know.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go to the home page
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </main>
    </div>
  );
}
