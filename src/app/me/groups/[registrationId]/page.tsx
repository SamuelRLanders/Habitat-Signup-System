import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/components/copy-link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { absoluteUrl } from "@/lib/request";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/time";
import { getGroupDetail } from "@/lib/groups/queries";

export const metadata: Metadata = { title: "Your group" };

// A group leader's view of who has joined their group.
export default async function GroupPage({
  params,
}: PageProps<"/me/groups/[registrationId]">) {
  const { registrationId } = await params;
  const user = await requireUser(`/me/groups/${registrationId}`);
  const group = await getGroupDetail(user.id, registrationId);
  if (!group) notFound();

  const { build, size, groupMembers } = group;
  const zone = build.timeZone;
  const joined = 1 + groupMembers.length;

  return (
    <>
      <Link
        href="/me"
        className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
      >
        Your signups
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{group.groupName ?? "Your group"}</h1>
        <p className="text-muted-foreground">
          Group of {size} at {build.name}, {build.address}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Who&apos;s joined</h2>
          <p className="text-sm text-muted-foreground">
            {joined} {joined === 1 ? "person has" : "people have"} joined this
            group. Check the names against who&apos;s coming, since people may
            have dropped out since joining.
          </p>
        </div>

        <ul className="flex flex-col divide-y hover-gold rounded-xl ring-1 ring-foreground/10">
          <MemberRow name={group.leaderName} joinedAt={group.createdAt} zone={zone} you />
          {groupMembers.map((member) => (
            <MemberRow
              key={member.id}
              name={member.legalName}
              joinedAt={member.createdAt}
              zone={zone}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Join link</h2>
        {group.open && group.joinToken ? (
          <>
            <p className="text-sm text-muted-foreground">
              Send this link to everyone in your group. Each person opens it and
              adds their name, birthday, and phone number. It works until your
              group&apos;s last shift starts.
            </p>
            <CopyLink url={absoluteUrl(`/join/${group.joinToken}`)} label="Group join link" />
          </>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm">
            {build.status === "CANCELLED"
              ? "The join link has closed because Habitat cancelled this build."
              : "The join link has closed because your group has no upcoming shifts."}
          </p>
        )}
      </section>

      {group.shifts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Upcoming shifts</h2>
          <ul className="flex flex-col gap-2">
            {group.shifts.map((shift) => (
              <li
                key={shift.startsAt.toISOString()}
                className="rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="font-medium">{formatDate(shift.startsAt, zone)}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function MemberRow({
  name,
  joinedAt,
  zone,
  you,
}: {
  name: string;
  joinedAt: Date;
  zone: string;
  you?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-3">
      <span className="font-medium">
        {name}
        {you && <span className="font-normal text-muted-foreground"> (you)</span>}
      </span>
      <span className="text-sm text-muted-foreground">
        Joined {formatDateTime(joinedAt, zone)}
      </span>
    </li>
  );
}
