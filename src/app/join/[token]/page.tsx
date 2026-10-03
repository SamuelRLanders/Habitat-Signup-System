import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuildSections } from "@/components/build-sections";
import { joinGroup } from "@/lib/groups/actions";
import { getGroupInvite } from "@/lib/groups/queries";
import { formatDate, formatTimeRange } from "@/lib/time";
import { JoinForm } from "./join-form";

// The link a group leader sends their group. Each member opens it and adds
// their details; they don't need an account.

export async function generateMetadata({
  params,
}: PageProps<"/join/[token]">): Promise<Metadata> {
  const { token } = await params;
  const group = await getGroupInvite(token);
  return {
    title: group ? `Join your group at ${group.build.name}` : "Join link not found",
    // The link is private to the group.
    robots: { index: false, follow: false },
  };
}

export default async function JoinGroupPage({
  params,
}: PageProps<"/join/[token]">) {
  const { token } = await params;
  const group = await getGroupInvite(token);
  if (!group) notFound();

  const { build, leaderName } = group;
  const zone = build.timeZone;

  const closedMessage = group.open
    ? null
    : build.status === "CANCELLED"
      ? "This join link has closed because Habitat cancelled this build."
      : "This join link has closed because the group has no upcoming shifts.";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-full bg-gold px-3 py-0.5 text-xs font-semibold text-black">
          Purdue Habitat volunteer group
        </p>
        <h1 className="text-3xl font-semibold">{build.name}</h1>
        <p className="text-muted-foreground">{build.address}</p>
      </header>

      {closedMessage ? (
        <p className="rounded-xl bg-muted p-4 text-sm">{closedMessage}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3 hover-gold rounded-xl bg-muted/50 p-5 ring-1 ring-foreground/10">
            <p>
              <strong>{leaderName}</strong> reserved a spot for you
              {group.groupName ? ` with ${group.groupName}` : ""}. Before you
              come, please fill in your details below.
            </p>
            <ul className="flex flex-col gap-2">
              {group.shifts.map((shift) => (
                <li
                  key={shift.startsAt.toISOString()}
                  className="hover-gold rounded-lg bg-background p-3 ring-1 ring-foreground/10"
                >
                  <span className="font-medium">{formatDate(shift.startsAt, zone)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {/* The build's own instructions, such as which waivers to sign. */}
          <BuildSections sections={build.sections} />
          <JoinForm action={joinGroup.bind(null, token)} buildName={build.name} />
        </>
      )}
    </main>
  );
}
