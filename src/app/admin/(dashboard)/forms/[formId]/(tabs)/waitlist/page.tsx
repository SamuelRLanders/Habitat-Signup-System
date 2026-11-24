import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { assignmentsOpen } from "@/lib/signup-forms/phase";
import { VolunteerTable } from "../../../../volunteer-table";
import { formTitle, loadFormPlan } from "../data";

export async function generateMetadata({
  params,
}: PageProps<"/admin/forms/[formId]/waitlist">): Promise<Metadata> {
  const { formId } = await params;
  return { title: await formTitle(formId, "Waitlist") };
}

// Everyone waiting on a form's waitlist, in the order they joined, with
// the full builds they're waiting for. While the form is open they're added
// automatically (src/lib/form-signups/waitlist.ts); after it closes, admins
// add them on the Assignments tab.
export default async function WaitlistPage({
  params,
}: PageProps<"/admin/forms/[formId]/waitlist">) {
  await requireAdmin();
  const { formId } = await params;

  const loaded = await loadFormPlan(formId);
  if (!loaded) notFound();
  const { form, waiting } = loaded;
  const labels = new Map(form.shifts.map((shift) => [shift.id, shift.name]));
  const closed = assignmentsOpen(form.phase);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex max-w-2xl flex-col gap-1 text-sm text-muted-foreground">
        <p>
          In the order they joined. Each person chose builds that were full for
          them, and is waiting for a spot at any of them.
        </p>
        <p>
          {closed ? (
            <>
              The form has closed, so nobody is added automatically. To add
              someone, check with them, then move them to a build on the{" "}
              <Link href={`/admin/forms/${form.id}/assignments`} className="underline underline-offset-4">
                Assignments tab
              </Link>
              .
            </>
          ) : (
            "While the form is open, they're added automatically, in this order, when someone cancels or a build gets more spots. They aren't emailed."
          )}
        </p>
        {!form.waitlist && (
          <p className="font-medium text-foreground">
            This form&apos;s waitlist is off, so nobody new can join it.
          </p>
        )}
      </div>

      {waiting.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Nobody is on the waitlist.
          </CardContent>
        </Card>
      ) : (
        <VolunteerTable
          day={form.day}
          shiftsHeading="Waiting for"
          travel={form.askTransportation}
          numbered
          dateHeading="Joined"
          rows={waiting.map((signup) => ({
            ...signup,
            createdAt: signup.waitlistedAt!,
            shifts: signup.shiftIds.flatMap((id) => labels.get(id) ?? []),
          }))}
        />
      )}
    </div>
  );
}
