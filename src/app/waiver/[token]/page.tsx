import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveWaiver } from "@/lib/signups/queries";
import { signGroupWaiver } from "@/lib/waivers/actions";
import { getGroupWaiver } from "@/lib/waivers/queries";
import { formatDate, formatTimeRange } from "@/lib/time";
import { MemberWaiverForm } from "./member-waiver-form";

// The link a group leader sends their group. Each member opens it and signs
// the waiver; they don't need an account.

export async function generateMetadata({
  params,
}: PageProps<"/waiver/[token]">): Promise<Metadata> {
  const { token } = await params;
  const group = await getGroupWaiver(token);
  return {
    title: group ? `Waiver for ${group.build.name}` : "Waiver link not found",
    // The link is private to the group.
    robots: { index: false, follow: false },
  };
}

export default async function GroupWaiverPage({
  params,
}: PageProps<"/waiver/[token]">) {
  const { token } = await params;
  const [group, waiver] = await Promise.all([
    getGroupWaiver(token),
    getActiveWaiver(),
  ]);
  if (!group) notFound();

  const { build, leaderName } = group;
  const zone = build.timeZone;

  const closedMessage = !group.open
    ? "This waiver link has closed because the group has no upcoming shifts."
    : !waiver
      ? "The waiver isn't available right now. Please try again later."
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Habitat for Humanity volunteer waiver
        </p>
        <h1 className="text-3xl font-semibold">{build.name}</h1>
        <p className="text-muted-foreground">{build.address}</p>
      </header>

      {closedMessage || !waiver ? (
        <p className="rounded-xl bg-muted p-4 text-sm">{closedMessage}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl bg-muted/50 p-5 ring-1 ring-foreground/10">
            <p>
              <strong>{leaderName}</strong> reserved a spot for you
              {group.groupName ? ` with ${group.groupName}` : ""}. Before you
              come, please fill in your details and sign the waiver below.
            </p>
            <ul className="flex flex-col gap-2">
              {group.shifts.map((shift) => (
                <li
                  key={shift.startsAt.toISOString()}
                  className="rounded-lg bg-background p-3 ring-1 ring-foreground/10"
                >
                  <span className="font-medium">{formatDate(shift.startsAt, zone)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <MemberWaiverForm
            action={signGroupWaiver.bind(null, token)}
            waiver={waiver}
            buildName={build.name}
          />
        </>
      )}
    </main>
  );
}
