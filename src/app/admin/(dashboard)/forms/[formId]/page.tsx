import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { FormSections } from "@/components/form-sections";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FormStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import { getFormRoster, type RosterSignup } from "@/lib/form-signups/rosters";
import { prisma } from "@/lib/prisma";
import { deleteSignupForm, setSignupFormStatus } from "@/lib/signup-forms/actions";
import { formPhase } from "@/lib/signup-forms/phase";
import { getSignupForm, shiftLabel, totalSpots } from "@/lib/signup-forms/queries";
import {
  DEFAULT_TIME_ZONE,
  formatDate,
  formatDay,
  formatTimeRange,
  timeZoneLabel,
  toDay,
} from "@/lib/time";
import { T_SHIRT_SIZES } from "@/lib/volunteers";
import { BackLink, SpotsMeter } from "../../builds/build-parts";
import { VolunteerTable } from "../../volunteer-table";
import { PhaseBadge, phaseNote } from "../form-parts";
import { ShareDialog } from "../share-dialog";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]">): Promise<Metadata> {
  const { formId } = await params;
  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    select: { date: true },
  });
  return { title: form ? `Form for ${formatDay(toDay(form.date), "short")}` : "Signup form" };
}

export default async function SignupFormPage({
  params,
}: PageProps<"/admin/forms/[formId]">) {
  await requireAdmin();
  const { formId } = await params;

  const form = await getSignupForm(formId);
  if (!form) notFound();

  const phase = formPhase(form);
  const spots = totalSpots(form.shifts);
  const roster = await getFormRoster(form.id, form.shifts);
  const active = roster.filter((signup) => !signup.cancelledAt);
  const cancelled = roster.filter((signup) => signup.cancelledAt);
  const labels = new Map(form.shifts.map((shift) => [shift.id, shiftLabel(shift)]));
  // How many active signups chose each shift.
  const willing = new Map<string, number>();
  for (const signup of active) {
    for (const id of signup.shiftIds) willing.set(id, (willing.get(id) ?? 0) + 1);
  }
  // The day's shifts under a heading for each build, in order of each
  // build's first shift.
  const builds = [...Map.groupBy(form.shifts, (shift) => shift.build.id).values()];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/admin/forms">Back to forms</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{formatDay(form.day)}</h1>
              <PhaseBadge phase={phase} />
            </div>
            <p className="text-sm text-muted-foreground">{phaseNote(phase, form)}</p>
            <p className="text-sm">
              {form.signupCount} {form.signupCount === 1 ? "volunteer has" : "volunteers have"} signed up
              {spots > 0 && ` of ${spots} ${spots === 1 ? "spot" : "spots"}`}.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {form.status === "PUBLISHED" && <ShareDialog path={`/signup/${form.id}`} />}
            <Link
              href={`/admin/forms/${form.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit form
            </Link>
            <StatusActions
              formId={form.id}
              status={form.status}
              signupCount={form.signupCount}
            />
          </div>
        </div>

        {form.description && <p className="whitespace-pre-line">{form.description}</p>}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="shifts-heading">
        <div>
          <h2 id="shifts-heading" className="text-lg font-semibold">
            Shifts
          </h2>
          <p className="text-sm text-muted-foreground">
            Every shift on this day, at every build. Volunteers say which
            ones they could work.
            {spots > 0 &&
              ` Up to ${spots} ${spots === 1 ? "volunteer" : "volunteers"} can sign up, the total spots on these shifts.`}
          </p>
        </div>

        {builds.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No shifts on this day yet. Add shifts for{" "}
              {formatDay(form.day, "short")} to a build and they&apos;ll show
              up here. Cancelled shifts and builds aren&apos;t offered.
            </CardContent>
          </Card>
        ) : (
          builds.map((shifts) => {
            const { build } = shifts[0];
            const zone = build.timeZone;
            return (
              <div key={build.id} className="flex flex-col gap-2">
                <div className="flex flex-col">
                  <Link
                    href={`/admin/builds/${build.id}`}
                    className="font-medium hover:underline"
                  >
                    {build.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">{build.address}</span>
                </div>
                <ul className="flex flex-col divide-y hover-gold rounded-xl ring-1 ring-foreground/10">
                  {shifts.map((shift) => (
                    <li
                      key={shift.id}
                      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 p-4"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Link
                          href={`/admin/builds/${build.id}/shifts/${shift.id}`}
                          className="font-medium hover:underline"
                        >
                          {formatTimeRange(shift.startsAt, shift.endsAt, zone)}
                          {zone !== DEFAULT_TIME_ZONE && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              ({timeZoneLabel(zone)})
                            </span>
                          )}
                        </Link>
                        {shift.notes && (
                          <p className="text-sm whitespace-pre-line text-muted-foreground">
                            {shift.notes}
                          </p>
                        )}
                      </div>
                      <SpotsMeter willing={willing.get(shift.id) ?? 0} capacity={shift.capacity} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="volunteers-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="volunteers-heading" className="text-lg font-semibold">
              Volunteers ({active.length})
            </h2>
            {active.length > 0 && <Totals signups={active} />}
          </div>
          {roster.length > 0 && (
            // A plain link, not <Link>: it downloads a file.
            <a
              href={`/admin/forms/${form.id}/export`}
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadIcon aria-hidden="true" />
              Download CSV
            </a>
          )}
        </div>

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
            rows={active.map((signup) => ({
              ...signup,
              shifts: signup.shiftIds.flatMap((id) => labels.get(id) ?? []),
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
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="sections-heading">
        <div>
          <h2 id="sections-heading" className="text-lg font-semibold">
            Sections
          </h2>
          <p className="text-sm text-muted-foreground">
            Shown to volunteers on the form, such as which waivers to sign.
          </p>
        </div>
        {form.sections.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No sections. Edit the form to add waiver links or instructions.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6 rounded-xl p-5 ring-1 ring-foreground/10">
            <FormSections sections={form.sections} />
          </div>
        )}
      </section>
    </div>
  );
}

// "T-shirts: S 2 · M 5 · L 3 · 4 with a driver's license", for ordering
// shirts and planning rides.
function Totals({ signups }: { signups: RosterSignup[] }) {
  const sizes = T_SHIRT_SIZES.flatMap((size) => {
    const count = signups.filter((signup) => signup.tShirtSize === size.value).length;
    return count > 0 ? [`${size.label} ${count}`] : [];
  });
  const drivers = signups.filter((signup) => signup.hasDriversLicense).length;
  return (
    <p className="text-sm text-muted-foreground">
      T-shirts: {sizes.join(" · ")} · {drivers} with a driver&apos;s license
    </p>
  );
}

// Drafts can be published or deleted; published forms can be unpublished.
function StatusActions({
  formId,
  status,
  signupCount,
}: {
  formId: string;
  status: FormStatus;
  signupCount: number;
}) {
  const setStatus = (next: FormStatus) => setSignupFormStatus.bind(null, formId, next);

  if (status === "PUBLISHED") {
    return (
      <ActionButton
        action={setStatus("DRAFT")}
        label="Unpublish"
        confirm={
          signupCount > 0
            ? {
                title: "Unpublish this form?",
                description:
                  "Volunteers have signed up. Their signups are kept, but they won't be able to see, update or cancel them until the form is published again.",
                confirmLabel: "Unpublish",
              }
            : undefined
        }
      />
    );
  }
  return (
    <>
      <ActionButton
        action={deleteSignupForm.bind(null, formId)}
        label="Delete"
        variant="ghost"
        confirm={{
          title: "Delete this form?",
          description: "The form and its sections will be permanently deleted. Builds and shifts aren't affected.",
          confirmLabel: "Delete form",
        }}
      />
      <ActionButton action={setStatus("PUBLISHED")} label="Publish" variant="default" />
    </>
  );
}
