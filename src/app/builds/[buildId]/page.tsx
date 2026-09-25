import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/dal";
import { loginPath } from "@/lib/auth/redirects";
import { formatPhone } from "@/lib/phone";
import { submitSignup } from "@/lib/signups/actions";
import {
  getActiveWaiver,
  getProfileDefaults,
  getSignupBuild,
} from "@/lib/signups/queries";
import { formatDate, formatTimeRange, timeZoneLabel } from "@/lib/time";
import { spotsText } from "@/lib/volunteers";
import { SignupForm, type ShiftOption } from "./signup-form";

// The signup page for one build, linked from the admin "Share" pill. Anyone
// can see the build and its shifts; signing up needs a signed-in volunteer.

export async function generateMetadata({
  params,
}: PageProps<"/builds/[buildId]">): Promise<Metadata> {
  const { buildId } = await params;
  const build = await getSignupBuild(buildId);
  return { title: build ? `Volunteer at ${build.name}` : "Build not found" };
}

export default async function BuildSignupPage({
  params,
}: PageProps<"/builds/[buildId]">) {
  const { buildId } = await params;
  const [build, user, waiver] = await Promise.all([
    getSignupBuild(buildId),
    getUser(),
    getActiveWaiver(),
  ]);
  if (!build) notFound();

  const zone = build.timeZone;
  const path = `/builds/${build.id}`;
  const shifts: ShiftOption[] = build.shifts.map((shift) => ({
    id: shift.id,
    date: formatDate(shift.startsAt, zone),
    time: formatTimeRange(shift.startsAt, shift.endsAt, zone),
    spotsLeft: shift.spotsLeft,
    notes: shift.notes,
  }));

  const closedMessage =
    build.status === "CLOSED"
      ? "Signups for this build are closed."
      : shifts.length === 0
        ? "There are no upcoming shifts to sign up for right now. Check back soon."
        : !waiver
          ? "Signups for this build aren't open yet. Check back soon."
          : null;

  let body: React.ReactNode;
  if (closedMessage || !waiver) {
    body = <p className="rounded-xl bg-muted p-4 text-sm">{closedMessage}</p>;
  } else if (!user) {
    body = (
      <SignedOut
        shifts={shifts}
        timeZone={timeZoneLabel(zone)}
        loginHref={loginPath(path)}
      />
    );
  } else {
    const profile = await getProfileDefaults(user.id);
    body = (
        <SignupForm
          action={submitSignup.bind(null, build.id)}
          timeZoneLabel={timeZoneLabel(zone)}
          shifts={shifts}
          waiver={waiver}
          defaults={
            profile && {
              ...profile,
              phone: formatPhone(profile.phone),
              emergencyContactPhone: formatPhone(profile.emergencyContactPhone),
            }
          }
        />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Habitat for Humanity volunteer signup
        </p>
        <h1 className="text-3xl font-semibold">{build.name}</h1>
        <p className="text-muted-foreground">{build.address}</p>
        {build.description && (
          <p className="mt-2 whitespace-pre-line">{build.description}</p>
        )}
      </header>
      {body}
    </main>
  );
}

// What visitors see before signing in: the shifts, and a way to sign in.
function SignedOut({
  shifts,
  timeZone,
  loginHref,
}: {
  shifts: ShiftOption[];
  timeZone: string;
  loginHref: string;
}) {
  const days = Map.groupBy(shifts, (shift) => shift.date);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-5 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Sign in to sign up</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a 6-digit code to confirm it&apos;s you. It
            only takes a minute, and your details are saved for next time.
          </p>
        </div>
        <Link
          href={loginHref}
          className={buttonVariants({ size: "lg", className: "w-full sm:w-fit" })}
        >
          Sign in to sign up
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Upcoming shifts</h2>
          <p className="text-sm text-muted-foreground">
            Times are in {timeZone} time.
          </p>
        </div>
        {[...days].map(([date, dayShifts]) => (
          <div key={date} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
            {dayShifts.map((shift) => (
              <div
                key={shift.id}
                className="flex flex-col gap-1 rounded-xl p-4 ring-1 ring-foreground/10"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-medium">{shift.time}</span>
                  <span className="text-sm text-muted-foreground">
                    {spotsText(shift.spotsLeft)}
                  </span>
                </span>
                {shift.notes && (
                  <span className="text-sm whitespace-pre-line text-muted-foreground">
                    {shift.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
