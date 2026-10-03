import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailCodeForm } from "@/components/email-code-form";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  forgetVerifiedEmail,
  sendSignupCode,
  verifySignupCode,
} from "@/lib/email-verification/actions";
import { getVerifiedEmail } from "@/lib/email-verification/session";
import { formPhase } from "@/lib/signup-forms/phase";
import { getPublicForm, type OfferedShift } from "@/lib/signup-forms/queries";
import {
  DEFAULT_TIME_ZONE,
  formatDay,
  formatTimeRange,
  formatWeekdayTime,
  timeZoneLabel,
} from "@/lib/time";

export async function generateMetadata({
  params,
}: PageProps<"/signup/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  const form = await getPublicForm(formId);
  return { title: form ? `Sign up for ${formatDay(form.day, "short")}` : "Signup form" };
}

// A build day's public signup form. Volunteers can look it over once it's
// published, sign up while it's open, and see that it's closed afterwards.
export default async function SignupFormPage({
  params,
}: PageProps<"/signup/[formId]">) {
  const { formId } = await params;
  const form = await getPublicForm(formId);
  if (!form) notFound();

  const phase = formPhase(form);
  const verifiedEmail = await getVerifiedEmail();
  const at = (date: Date) => formatWeekdayTime(date, DEFAULT_TIME_ZONE);

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:py-16">
        <header className="flex flex-col gap-2">
          <p className="w-fit rounded-full bg-gold px-3 py-0.5 text-xs font-semibold text-black">
            Purdue Habitat volunteer signup
          </p>
          <h1 className="text-3xl font-semibold">{formatDay(form.day)}</h1>
          {phase === "open" && (
            <p className="text-muted-foreground">Sign up by {at(form.closesAt)}.</p>
          )}
        </header>

        {phase === "closed" ? (
          <Notice title="This form has closed">
            Signups for this build day ended {at(form.closesAt)}.{" "}
            <Link href="/" className="underline underline-offset-4">
              See other build days
            </Link>
            .
          </Notice>
        ) : (
          <>
            {phase === "not-open" && (
              <Notice title={`Signups open ${at(form.opensAt)}`}>
                You can look over the day&apos;s shifts now. Come back then to
                sign up.
              </Notice>
            )}

            {form.description && (
              <p className="whitespace-pre-line">{form.description}</p>
            )}

            <Shifts shifts={form.shifts} />

            {phase === "open" && (
              <section className="flex flex-col gap-4" aria-labelledby="signup-heading">
                <h2 id="signup-heading" className="text-lg font-semibold">
                  Sign up
                </h2>
                {verifiedEmail ? (
                  <>
                    <VerifiedEmail email={verifiedEmail} />
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground">
                        The rest of the signup form is almost ready. Check
                        back soon.
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="flex flex-col gap-4 rounded-xl p-5 ring-1 ring-foreground/10">
                    <p className="text-sm text-muted-foreground">
                      First, confirm your email address. We&apos;ll send you a
                      6-digit code. You don&apos;t need an account.
                    </p>
                    <EmailCodeForm
                      sendAction={sendSignupCode.bind(null, form.id)}
                      verifyAction={verifySignupCode}
                      verifyLabels={{ idle: "Continue", pending: "Checking…" }}
                      restartHref={`/signup/${form.id}`}
                    />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// The email this browser confirmed, with a way to switch to another, such
// as on a shared computer.
function VerifiedEmail({ email }: { email: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
      <span>
        Signing up as <strong>{email}</strong>
      </span>
      <form action={forgetVerifiedEmail}>
        <Button type="submit" variant="outline" size="sm">
          Not you? Use a different email
        </Button>
      </form>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl border-l-4 border-gold bg-gold/15 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm">{children}</p>
    </div>
  );
}

// The day's shifts under a heading for each build. Volunteers don't pick a
// shift: they say which ones they could work, and admins place them.
function Shifts({ shifts }: { shifts: OfferedShift[] }) {
  const builds = [...Map.groupBy(shifts, (shift) => shift.build.id).values()];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="shifts-heading">
      <div className="flex flex-col gap-1">
        <h2 id="shifts-heading" className="text-lg font-semibold">
          Shifts
        </h2>
        <p className="text-sm text-muted-foreground">
          When you sign up, you&apos;ll say which of these shifts you could
          work. We&apos;ll let you know where you&apos;re placed.
        </p>
      </div>

      {builds.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            No shifts are scheduled for this day right now.
          </CardContent>
        </Card>
      ) : (
        builds.map((buildShifts) => {
          const { build } = buildShifts[0];
          const zone = build.timeZone;
          return (
            <div key={build.id} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium">{build.name}</h3>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(build.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-sm text-muted-foreground hover:underline"
                >
                  {build.address}
                </a>
                {build.description && (
                  <p className="mt-1 text-sm whitespace-pre-line">{build.description}</p>
                )}
              </div>
              <ul className="flex flex-col divide-y rounded-lg bg-muted/40">
                {buildShifts.map((shift) => (
                  <li key={shift.id} className="flex flex-col gap-0.5 px-3 py-2">
                    <span className="text-sm font-medium">
                      {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                      {zone !== DEFAULT_TIME_ZONE && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          ({timeZoneLabel(zone)} time)
                        </span>
                      )}
                    </span>
                    {shift.notes && (
                      <span className="text-sm whitespace-pre-line text-muted-foreground">
                        {shift.notes}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
