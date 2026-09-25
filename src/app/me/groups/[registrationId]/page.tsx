import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/components/copy-link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { absoluteUrl } from "@/lib/request";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/time";
import { getGroupDetail } from "@/lib/waivers/queries";

export const metadata: Metadata = { title: "Your group" };

// A group leader's view of who in their group has signed the waiver.
export default async function GroupPage({
  params,
}: PageProps<"/me/groups/[registrationId]">) {
  const { registrationId } = await params;
  const user = await requireUser(`/me/groups/${registrationId}`);
  const group = await getGroupDetail(user.id, registrationId);
  if (!group) notFound();

  const { build, size, groupMembers, leaderSignature } = group;
  const zone = build.timeZone;
  const signed = 1 + groupMembers.length;

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
          <h2 className="text-lg font-semibold">Waivers</h2>
          <p className="text-sm text-muted-foreground">
            {signed} {signed === 1 ? "waiver has" : "waivers have"} been signed
            for this group. Check the names against who&apos;s coming, since
            people may have joined or dropped out since signing.
          </p>
        </div>

        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
          <SignerRow
            name={leaderSignature?.signedName ?? user.name}
            signedAt={leaderSignature?.signedAt ?? null}
            zone={zone}
            you
          />
          {groupMembers.map((member) => (
            <SignerRow
              key={member.id}
              name={member.legalName}
              signedAt={member.createdAt}
              zone={zone}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Waiver link</h2>
        {group.open && group.waiverToken ? (
          <>
            <p className="text-sm text-muted-foreground">
              Send this link to everyone in your group. Each person opens it and
              signs with their full legal name. It works until your group&apos;s
              last shift starts.
            </p>
            <CopyLink url={absoluteUrl(`/waiver/${group.waiverToken}`)} label="Group waiver link" />
          </>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm">
            The waiver link has closed because your group has no upcoming shifts.
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

function SignerRow({
  name,
  signedAt,
  zone,
  you,
}: {
  name: string;
  signedAt: Date | null;
  zone: string;
  you?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-3">
      <span className="font-medium">
        {name}
        {you && <span className="font-normal text-muted-foreground"> (you)</span>}
      </span>
      {signedAt && (
        <span className="text-sm text-muted-foreground">
          Signed {formatDateTime(signedAt, zone)}
        </span>
      )}
    </li>
  );
}
