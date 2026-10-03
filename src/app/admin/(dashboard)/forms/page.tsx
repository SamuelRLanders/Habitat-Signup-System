import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { formPhase } from "@/lib/signup-forms/phase";
import {
  FORM_LIST_TABS,
  listSignupForms,
  type FormListTab,
} from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";
import { PhaseBadge, phaseNote } from "./form-parts";

export const metadata: Metadata = { title: "Signup forms" };

const tabs: Record<FormListTab, { label: string; empty: string }> = {
  upcoming: { label: "Upcoming", empty: "No signup forms for upcoming build days." },
  past: { label: "Past", empty: "No past signup forms." },
};

export default async function SignupFormsPage({
  searchParams,
}: PageProps<"/admin/forms">) {
  // Every admin page checks on its own. The layout's check doesn't re-run
  // when navigating between pages that share it.
  await requireAdmin();

  const { tab: tabParam } = await searchParams;
  const tab = FORM_LIST_TABS.find((t) => t === tabParam) ?? "upcoming";
  const forms = await listSignupForms(tab);
  const now = new Date();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Signup forms</h1>
          <Link href="/admin/forms/new" className={buttonVariants()}>
            New form
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          One form per build day. Volunteers sign up through its link and say
          which of the day&apos;s shifts they could work.
        </p>
      </div>

      <nav
        aria-label="Filter forms"
        className="flex w-fit gap-1 rounded-full bg-muted p-1"
      >
        {FORM_LIST_TABS.map((t) => (
          <Link
            key={t}
            href={t === "upcoming" ? "/admin/forms" : `/admin/forms?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "hover-gold rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
              t === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tabs[t].label}
          </Link>
        ))}
      </nav>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <p>{tabs[tab].empty}</p>
            {tab === "upcoming" && (
              <Link href="/admin/forms/new" className={buttonVariants({ variant: "outline" })}>
                Create a form
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {forms.map((form) => {
            const phase = formPhase(form, now);
            return (
              <li key={form.id}>
                <Link
                  href={`/admin/forms/${form.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 hover-gold rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{formatDay(form.day)}</span>
                      <PhaseBadge phase={phase} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {phaseNote(phase, form)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {form.shiftCount === 0 ? (
                      <span className="text-destructive">No shifts on this day</span>
                    ) : (
                      <>
                        {form.shiftCount} {form.shiftCount === 1 ? "shift" : "shifts"}
                        {" · "}
                        {form.spots} {form.spots === 1 ? "spot" : "spots"}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
