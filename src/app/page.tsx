import Link from "next/link";
import { SiteBrand } from "@/components/site-brand";
import { Card, CardContent } from "@/components/ui/card";

// The public home page, where volunteers find signup forms without signing
// in. Forms aren't built yet, so the list is always empty for now.
export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b-4 border-gold px-4 py-3">
        <SiteBrand href="/" label="Purdue Habitat Volunteering" />
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Admin sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">Volunteer with Purdue Habitat</h1>
          <span aria-hidden="true" className="h-1 w-16 rounded-full bg-gold" />
          <p className="text-muted-foreground">
            Choose a build day below and fill out its signup form. You
            don&apos;t need an account.
          </p>
        </div>

        <section className="flex flex-col gap-3" aria-labelledby="forms-heading">
          <h2 id="forms-heading" className="text-lg font-semibold">
            Upcoming build days
          </h2>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No signup forms are open right now. Check back soon.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
