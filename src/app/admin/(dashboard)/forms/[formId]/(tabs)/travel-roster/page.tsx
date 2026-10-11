import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import type { RosterSignup } from "@/lib/form-signups/rosters";
import { travelRosterFor } from "@/lib/placement/load";
import { formTitle, loadFormPlan } from "../data";
import { RosterText } from "./roster-text";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]/travel-roster">): Promise<Metadata> {
  const { formId } = await params;
  return { title: await formTitle(formId, "Travel roster") };
}

// Purdue's travel roster for a form: who's going to each build, who's
// driving, and who rides with them, following the build assignments, with
// anything to check before sending it.
export default async function TravelRosterPage({
  params,
}: PageProps<"/admin/forms/[formId]/travel-roster">) {
  await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, active, custom, plan } = loaded;

  const travel = travelRosterFor(form.day, form.shifts, active, plan.placement, form);
  const pendingDrivers = [...plan.pendingDrivers.values()].reduce((sum, n) => sum + n, 0);
  const warnings = [
    plan.leftOut.length > 0 &&
      (custom
        ? `Not on the roster because they aren't assigned a build: ${names(plan.leftOut)}.`
        : `Not on the roster because they can't be placed right now: ${names(plan.leftOut)}.`),
    travel.withoutRide > 0 &&
      `${plural(travel.withoutRide, "rider doesn't", "riders don't")} have a driver yet (marked "No ride yet").`,
    pendingDrivers > 0 &&
      `${plural(pendingDrivers, "driver is", "drivers are")} still waiting for Purdue approval (marked "approval pending").`,
  ].filter((warning) => typeof warning === "string");

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        For Purdue: who&apos;s going to each build, who&apos;s driving, and who rides with
        them. It follows the build assignments (the app&apos;s placement until custom ones
        are saved), so it changes as people sign up, cancel or are moved. Send it once
        signups close.
      </p>
      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Nobody has signed up yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <RosterText text={travel.text} />
        </>
      )}
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const names = (signups: RosterSignup[]) =>
  signups.map((signup) => `${signup.firstName} ${signup.lastName}`).join(", ");
