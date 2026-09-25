import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { cancelSignup, changeGroupSize } from "@/lib/me/actions";
import { getMySignups, getOpenBuilds, hasProfile } from "@/lib/me/queries";
import { formatDate, formatDateRange, formatTimeRange } from "@/lib/time";
import { GroupSizeDialog, WaiverLinkDialog } from "./group-dialogs";

export const metadata: Metadata = { title: "Your signups" };

type Upcoming = Awaited<ReturnType<typeof getMySignups>>["upcoming"][number];
type Past = Awaited<ReturnType<typeof getMySignups>>["past"][number];

// A volunteer's home page: their upcoming shifts (with cancelling and group
// changes), builds they can sign up for, and past shifts.
export default async function MePage() {
  const user = await requireUser("/me");
  const [{ upcoming, past }, openBuilds, profileSaved] = await Promise.all([
    getMySignups(user.id),
    getOpenBuilds(),
    hasProfile(user.id),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">
        {profileSaved ? `Hi, ${user.name.split(" ")[0]}` : "Welcome"}
      </h1>

      {!profileSaved && (
        <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-5 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">Add your details</h2>
            <p className="text-sm text-muted-foreground">
              Fill in your contact and emergency details once, and they&apos;ll
              be ready whenever you sign up. You can also add them when you
              sign up for your first build.
            </p>
          </div>
          <Link
            href="/me/profile"
            className={buttonVariants({ size: "sm", className: "w-fit" })}
          >
            Add your details
          </Link>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Upcoming shifts</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm">
            You&apos;re not signed up for any upcoming shifts.
            {openBuilds.length > 0 && " Pick a build below to get started."}
          </p>
        ) : (
          upcoming.map((registration) => (
            <RegistrationCard key={registration.id} registration={registration} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Builds you can sign up for</h2>
        {openBuilds.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm">
            There are no builds open for signups right now. Check back soon.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openBuilds.map((build) => (
              <li
                key={build.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{build.name}</span>
                  <span className="text-sm text-muted-foreground">{build.address}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDateRange(build.firstStart, build.lastEnd, build.timeZone)} ·{" "}
                    {build.shiftCount} {build.shiftCount === 1 ? "shift" : "shifts"}
                  </span>
                </div>
                <Link
                  href={`/builds/${build.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  See shifts
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="group flex flex-col gap-4">
          <summary className="w-fit cursor-pointer text-lg font-semibold">
            Past shifts ({past.length})
          </summary>
          <ul className="mt-4 flex flex-col gap-2">
            {past.map((signup) => (
              <PastShift key={signup.id} signup={signup} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function RegistrationCard({ registration }: { registration: Upcoming }) {
  const { build, size, groupName, waiverToken, waiversSigned, active } =
    registration;
  const zone = build.timeZone;
  const isGroup = size > 1;

  return (
    <article className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/builds/${build.id}`} className="font-semibold hover:underline">
            {build.name}
          </Link>
          <span className="text-sm text-muted-foreground">{build.address}</span>
          {isGroup && (
            <span className="text-sm">
              {groupName ? `${groupName} · ` : ""}Group of {size} ·{" "}
              {waiversSigned} {waiversSigned === 1 ? "waiver" : "waivers"} signed
            </span>
          )}
        </div>
        {isGroup && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/me/groups/${registration.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View waivers
            </Link>
            {active && waiverToken && (
              <WaiverLinkDialog path={`/waiver/${waiverToken}`} />
            )}
            {active && (
              <GroupSizeDialog
                action={changeGroupSize.bind(null, registration.id)}
                size={size}
                signed={waiversSigned}
              />
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {registration.shifts.map((signup) => {
          const { shift } = signup;
          const cancelledByHabitat = shift.cancelledAt !== null;
          return (
            <li
              key={signup.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
            >
              <div className="flex flex-col">
                <span
                  className={
                    cancelledByHabitat
                      ? "font-medium text-muted-foreground line-through"
                      : "font-medium"
                  }
                >
                  {formatDate(shift.startsAt, zone)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                </span>
                {shift.notes && !cancelledByHabitat && (
                  <span className="text-sm whitespace-pre-line text-muted-foreground">
                    {shift.notes}
                  </span>
                )}
              </div>
              {cancelledByHabitat ? (
                <Badge variant="destructive">Cancelled by Habitat</Badge>
              ) : (
                <ActionButton
                  action={cancelSignup.bind(null, signup.id)}
                  label="Cancel"
                  confirm={{
                    title: "Cancel this shift?",
                    description: `${formatDate(shift.startsAt, zone)}, ${formatTimeRange(shift.startsAt, shift.endsAt, zone)} at ${build.name}.${
                      isGroup
                        ? ` This frees all ${size} of your group's spots on this shift. Your group's other shifts stay booked.`
                        : " Your other shifts stay booked."
                    }`,
                    confirmLabel: "Cancel shift",
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function PastShift({ signup }: { signup: Past }) {
  const { shift, build } = signup;
  return (
    <li className="flex flex-col rounded-lg bg-muted/40 px-3 py-2 text-sm">
      <span className="font-medium">{build.name}</span>
      <span className="text-muted-foreground">
        {formatDate(shift.startsAt, build.timeZone)},{" "}
        {formatTimeRange(shift.startsAt, shift.endsAt, build.timeZone)}
        {signup.size > 1 && ` · Group of ${signup.size}`}
      </span>
    </li>
  );
}
