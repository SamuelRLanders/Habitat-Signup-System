import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// The home page: a short welcome and the way in.
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">Habitat for Humanity Volunteers</h1>
          <p className="text-muted-foreground">
            Sign up for shifts on our home builds, and see or change the shifts
            you&apos;re signed up for. Sign in with your email to get started.
          </p>
        </div>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
