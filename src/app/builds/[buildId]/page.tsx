import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { submitSignup } from "@/lib/signups/actions";
import { getSignupBuild } from "@/lib/signups/queries";
import { formatDate, formatTimeRange, timeZoneLabel } from "@/lib/time";
import { SignupForm } from "./signup-form";

// The public signup page for one build, linked from the admin "Share" pill.

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
  const build = await getSignupBuild(buildId);
  if (!build) notFound();

  const zone = build.timeZone;
  const closedMessage =
    build.status === "CLOSED"
      ? "Signups for this build are closed."
      : build.shifts.length === 0
        ? "There are no upcoming shifts to sign up for right now. Check back soon."
        : null;

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

      {closedMessage ? (
        <p className="rounded-xl bg-muted p-4 text-sm">{closedMessage}</p>
      ) : (
        <SignupForm
          action={submitSignup.bind(null, build.id)}
          timeZoneLabel={timeZoneLabel(zone)}
          shifts={build.shifts.map((shift) => ({
            id: shift.id,
            date: formatDate(shift.startsAt, zone),
            time: formatTimeRange(shift.startsAt, shift.endsAt, zone),
            spotsLeft: shift.spotsLeft,
            notes: shift.notes,
          }))}
        />
      )}
    </main>
  );
}
