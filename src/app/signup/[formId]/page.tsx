import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/panel";
import { PublicHeader } from "@/components/public-header";
import { formPhase } from "@/lib/signup-forms/phase";
import { getPublicForm } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDay, formatWeekdayTime } from "@/lib/time";
import { SignupArea } from "./signup-area";

export async function generateMetadata({
  params,
}: PageProps<"/signup/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  const form = await getPublicForm(formId);
  return { title: form ? `Sign up for ${formatDay(form.day, "short")}` : "Signup form" };
}

// A build day's public signup form, as a column of panels: the build
// details (always shown), then signing in with an email, then the form.
// Volunteers can look it over once it's published and sign up while it's
// open. After it closes it says so, and those who signed up can still
// cancel until the day's first shift. The day's builds and shifts are shown
// once the volunteer has signed in, where they choose them.
export default async function SignupFormPage({
  params,
}: PageProps<"/signup/[formId]">) {
  const { formId } = await params;
  const form = await getPublicForm(formId);
  if (!form) notFound();

  const phase = formPhase(form);
  const at = (date: Date) => formatWeekdayTime(date, DEFAULT_TIME_ZONE);

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-14">
        <Panel>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold">{formatDay(form.day)}</h1>
            <p className="text-sm text-muted-foreground">
              {phase === "not-open"
                ? `Signups open ${at(form.opensAt)} and close ${at(form.closesAt)}.`
                : phase === "open"
                  ? `Signups are open until ${at(form.closesAt)}.`
                  : `Signups closed ${at(form.closesAt)}.`}
            </p>
          </div>
          {form.description && <p className="whitespace-pre-line">{form.description}</p>}

          {phase === "not-open" && (
            <Notice>Come back once signups open to sign up.</Notice>
          )}
          {phase === "closed" && (
            <Notice>
              This form has closed.{" "}
              <Link href="/" className="underline underline-offset-4">
                See other build days
              </Link>
              .
            </Notice>
          )}
        </Panel>

        <SignupArea form={form} phase={phase} />
      </main>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-2xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm font-medium">
      {children}
    </p>
  );
}
