import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { updateSignupForm } from "@/lib/signup-forms/actions";
import { offeredShifts } from "@/lib/signup-forms/queries";
import {
  DEFAULT_TIME_ZONE,
  formatDate,
  formatDay,
  toDateInput,
  toDay,
  toTimeInput,
} from "@/lib/time";
import { BackLink } from "../../../admin-parts";
import { FormEditor } from "../../form-editor";

export const metadata: Metadata = { title: "Edit signup form" };

export default async function EditSignupFormPage({
  params,
}: PageProps<"/admin/forms/[formId]/edit">) {
  await requireAdmin();
  const { formId } = await params;

  const form = await prisma.signupForm.findUnique({
    where: { id: formId },
    include: {
      shifts: {
        orderBy: offeredShifts.orderBy,
        include: { _count: { select: { preferences: true } } },
      },
      sections: { orderBy: { position: "asc" }, select: { title: true, body: true } },
    },
  });
  if (!form) notFound();

  const formHref = `/admin/forms/${form.id}`;
  // A cancelled event's form is kept as it was.
  if (form.status === "CANCELLED") redirect(formHref);
  const zone = DEFAULT_TIME_ZONE;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={formHref}>Back to form</BackLink>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            Edit {form.name}, {formatDay(toDay(form.date), "short")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created by {form.createdByName || "an admin"} on{" "}
            {formatDate(form.createdAt, zone)}
          </p>
        </div>
      </div>
      <FormEditor
        action={updateSignupForm.bind(null, form.id)}
        defaults={{
          name: form.name,
          date: toDay(form.date),
          opensDate: toDateInput(form.opensAt, zone),
          opensTime: toTimeInput(form.opensAt, zone),
          closesDate: toDateInput(form.closesAt, zone),
          closesTime: toTimeInput(form.closesAt, zone),
          description: form.description ?? "",
          listed: form.listed ? "yes" : "no",
          askTransportation: form.askTransportation ? "yes" : "no",
          askGroups: form.askGroups ? "yes" : "no",
        }}
        builds={form.shifts.map((shift) => ({
          id: shift.id,
          name: shift.name,
          address: shift.address,
          startTime: toTimeInput(shift.startsAt, zone),
          endTime: toTimeInput(shift.endsAt, zone),
          capacity: String(shift.capacity),
          description: shift.description ?? "",
          lunch: shift.lunch ?? "",
          cancelled: shift.cancelledAt !== null,
          // Everyone who ever chose it, including cancelled signups, so the
          // record is kept.
          chosen: shift._count.preferences > 0,
        }))}
        sections={form.sections}
        submitLabel="Save changes"
        cancelHref={formHref}
      />
    </div>
  );
}
