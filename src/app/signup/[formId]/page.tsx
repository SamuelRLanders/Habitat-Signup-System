import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/panel";
import { PublicHeader } from "@/components/public-header";
import { formPhase } from "@/lib/signup-forms/phase";
import { getPublicForm } from "@/lib/signup-forms/queries";
import { openGraphDefaults } from "@/lib/site-metadata";
import { DEFAULT_TIME_ZONE, formatDay, formatWeekdayTime } from "@/lib/time";
import { SignupArea } from "./signup-area";

export async function generateMetadata({
  params,
}: PageProps<"/signup/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  const form = await getPublicForm(formId);
  if (!form) return { title: "Signup form" };

  const title = `Sign up for ${form.name}, ${formatDay(form.day, "short")}`;
  const description = previewDescription(form);
  return {
    title,
    description,
    // The card shown when the link is shared in a chat or post.
    openGraph: { ...openGraphDefaults, title, description, url: `/signup/${form.id}` },
  };
}

// For link previews: "Saturday, October 24, 2026 · Maple Street Home, Birch
// Avenue · Sign up by Tue, Oct 20 at 5:00 PM."
function previewDescription(form: NonNullable<Awaited<ReturnType<typeof getPublicForm>>>) {
  const day = formatDay(form.day);
  const phase = formPhase(form);
  if (phase === "cancelled") return `${day} · This build day has been cancelled.`;

  const at = (date: Date) => formatWeekdayTime(date, DEFAULT_TIME_ZONE);
  const builds = [...new Set(form.shifts.map((shift) => shift.name))].join(", ");
  const when =
    phase === "not-open"
      ? `Signups open ${at(form.opensAt)}.`
      : phase === "open"
        ? `Sign up by ${at(form.closesAt)}.`
        : "Signups have closed.";
  return [day, builds, when].filter(Boolean).join(" · ");
}

// A build day's public signup form, as a column of panels: the build
// details (always shown), then signing in with an email, then the form.
// Volunteers can look it over once it's published and sign up while it's
// open. After it closes it says so, and those who signed up can still
// cancel until the day's first shift. A cancelled event's form only says
// so. The day's builds and shifts are shown once the volunteer has signed
// in, where they choose them.
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
            <h1 className="text-3xl font-semibold">{form.name}</h1>
            <p className="text-lg font-medium">{formatDay(form.day)}</p>
            {phase !== "cancelled" && (
              <p className="text-sm text-muted-foreground">
                {phase === "not-open"
                  ? `Signups open ${at(form.opensAt)} and close ${at(form.closesAt)}.`
                  : phase === "open"
                    ? `Signups are open until ${at(form.closesAt)}.`
                    : `Signups closed ${at(form.closesAt)}.`}
              </p>
            )}
          </div>
          {phase === "cancelled" ? (
            <Notice>
              This build day has been cancelled, along with everyone&apos;s
              signups for it.{" "}
              <Link href="/" className="underline underline-offset-4">
                See other build days
              </Link>
              .
            </Notice>
          ) : (
            form.description && <p className="whitespace-pre-line">{form.description}</p>
          )}

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
