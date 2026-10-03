import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formPhase } from "@/lib/signup-forms/phase";
import { listPublicForms } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDay, formatWeekdayTime } from "@/lib/time";

// The public home page, where volunteers find a build day's signup form
// without signing in. Lists published forms until they close.
export default async function HomePage() {
  const forms = await listPublicForms();
  const now = new Date();

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />

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
          {forms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No signup forms are open right now. Check back soon.
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {forms.map((form) => {
                const open = formPhase(form, now) === "open";
                const at = (date: Date) => formatWeekdayTime(date, DEFAULT_TIME_ZONE);
                return (
                  <li key={form.id}>
                    <Link
                      href={`/signup/${form.id}`}
                      className="flex flex-col gap-1 hover-gold rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{formatDay(form.day)}</span>
                        {open ? (
                          <Badge className="bg-gold text-black">Open</Badge>
                        ) : (
                          <Badge variant="outline">Opens soon</Badge>
                        )}
                      </span>
                      {form.buildNames.length > 0 && (
                        <span className="text-sm">{form.buildNames.join(" · ")}</span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {open
                          ? `Sign up by ${at(form.closesAt)}`
                          : `Signups open ${at(form.opensAt)}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
