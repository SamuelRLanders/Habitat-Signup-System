import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { buttonVariants } from "@/components/ui/button";

// For a link to a form that doesn't exist or isn't published.
export default function SignupFormNotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold">Signup form not found</h1>
        <p className="text-muted-foreground">
          This link doesn&apos;t go to a signup form that&apos;s available. It
          may have been mistyped, or the form may have been taken down.
        </p>
        <Link href="/" className={buttonVariants()}>
          See upcoming build days
        </Link>
      </main>
    </div>
  );
}
