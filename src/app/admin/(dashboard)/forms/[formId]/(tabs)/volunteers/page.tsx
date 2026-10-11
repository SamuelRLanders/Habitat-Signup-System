import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { EXPERIENCE_LABELS, EXPERIENCE_LEVELS, experienceOf } from "@/lib/experience";
import type { RosterSignup } from "@/lib/form-signups/rosters";
import { requestedPairs, type FormQuestions } from "@/lib/placement/load";
import type { Placement } from "@/lib/placement/solver";
import { DEFAULT_TIME_ZONE, formatDate } from "@/lib/time";
import { T_SHIRT_SIZES } from "@/lib/volunteers";
import { VolunteerTable } from "../../../../volunteer-table";
import { formTitle, loadFormPlan } from "../data";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]/volunteers">): Promise<Metadata> {
  const { formId } = await params;
  return { title: await formTitle(formId, "Volunteers") };
}

// Everyone signed up through a form: totals, the CSV download, the table,
// and anyone who cancelled.
export default async function VolunteersPage({
  params,
}: PageProps<"/admin/forms/[formId]/volunteers">) {
  await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, active, cancelled, plan } = loaded;
  // Builds on a form have different names, so a name is enough.
  const labels = new Map(form.shifts.map((shift) => [shift.id, shift.name]));
  const friends = friendsOf(active, plan.placement, form.askGroups);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(active.length > 0 || cancelled.length > 0) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {active.length > 0 ? <Totals signups={active} placement={plan.placement} questions={form} /> : <span />}
          {/* A plain link, not <Link>: it downloads a file. */}
          <a
            href={`/admin/forms/${form.id}/export`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon aria-hidden="true" />
            Download CSV
          </a>
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Nobody has signed up yet.
          </CardContent>
        </Card>
      ) : (
        <VolunteerTable
          day={form.day}
          shiftsHeading="Could work"
          travel={form.askTransportation}
          rows={active.map((signup) => ({
            ...signup,
            shifts: signup.shiftIds.flatMap((id) => labels.get(id) ?? []),
            friends: friends.get(signup.id),
          }))}
        />
      )}

      {cancelled.length > 0 && (
        <details className="rounded-xl p-4 text-sm ring-1 ring-foreground/10">
          <summary className="cursor-pointer font-medium">
            Cancelled signups ({cancelled.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-1">
            {cancelled.map((signup) => (
              <li key={signup.id}>
                {signup.firstName} {signup.lastName} ·{" "}
                <a href={`mailto:${signup.email}`} className="hover:underline">
                  {signup.email}
                </a>{" "}
                <span className="text-muted-foreground">
                  · cancelled {formatDate(signup.cancelledAt!, DEFAULT_TIME_ZONE)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// "T-shirts: S 2 · M 5 · L 3", "Experience: High 2 · New 6" and "3 need a ride · 2 can drive (1 approved,
// 1 pending), 9 seats", for ordering shirts and planning rides. A driver
// declined or revoked after signing up counts as no longer approved. A form
// that doesn't ask how volunteers are getting there leaves out the rides.
function Totals({
  signups,
  placement,
  questions,
}: {
  signups: RosterSignup[];
  placement: Placement;
  questions: FormQuestions;
}) {
  const count = (test: (signup: RosterSignup) => boolean) => signups.filter(test).length;
  const sizes = T_SHIRT_SIZES.flatMap((size) => {
    const n = count((signup) => signup.tShirtSize === size.value);
    return n > 0 ? [`${size.label} ${n}`] : [];
  });
  const drivers = signups.filter((signup) => signup.transportation === "CAN_DRIVE");
  const approved = drivers.filter((signup) => signup.driver.status === "approved").length;
  const pending = drivers.filter((signup) => signup.driver.status === "pending").length;
  const seats = drivers.reduce((sum, signup) => sum + (signup.carSeats ?? 0), 0);
  const levels = EXPERIENCE_LEVELS.flatMap((level) => {
    const n = count((signup) => experienceOf(signup.builds) === level);
    return n > 0 ? [`${EXPERIENCE_LABELS[level]} ${n}`] : [];
  });
  const pairs = requestedPairs(signups, questions.askGroups);
  const together = pairs.filter(([a, b]) => placement.has(a) && placement.get(a) === placement.get(b));
  return (
    <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
      <p>T-shirts: {sizes.join(" · ")}</p>
      <p>Experience: {levels.join(" · ")}</p>
      {questions.askTransportation && (
        <p>
          {count((s) => s.transportation === "NEEDS_RIDE")} need a ride ·{" "}
          {drivers.length} can drive ({approved} approved, {pending} pending
          {drivers.length - approved - pending > 0 &&
            `, ${drivers.length - approved - pending} no longer approved`}
          ),{" "}
          {seats} {seats === 1 ? "seat" : "seats"} · {count((s) => s.transportation === "OWN_WAY")} getting
          there on their own
        </p>
      )}
      {pairs.length > 0 && (
        <p>
          Friends: {together.length} of {plural(pairs.length, "pair", "pairs")} together in the build
          assignments
        </p>
      )}
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const name = (signup: RosterSignup) => `${signup.firstName} ${signup.lastName}`;

// Each volunteer's friends (by signup ID): who they asked to be placed
// with, and who asked for them, noting whether the build assignments keep
// them together. One request is enough, so a friend is listed on both.
// Nobody has friends on a form that doesn't ask.
function friendsOf(active: RosterSignup[], placement: Placement, askGroups: boolean) {
  const byEmail = new Map(active.map((signup) => [signup.email, signup]));
  const friends = new Map(active.map((signup) => [signup.id, [] as { label: string; note: string }[]]));
  if (!askGroups) return friends;
  const link = (signup: RosterSignup, other: RosterSignup) => {
    const list = friends.get(signup.id)!;
    if (list.some((friend) => friend.label === name(other))) return;
    const where = placement.get(signup.id);
    list.push({ label: name(other), note: where && where === placement.get(other.id) ? "together" : "apart" });
  };
  for (const signup of active) {
    for (const email of signup.groupEmails) {
      const other = byEmail.get(email);
      if (!other) friends.get(signup.id)!.push({ label: email, note: "not signed up" });
      else if (other.id !== signup.id) {
        link(signup, other);
        link(other, signup);
      }
    }
  }
  return friends;
}
