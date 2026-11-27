import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { buttonVariants } from "@/components/ui/button";
import type { FormStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import type { FormQuestions } from "@/lib/placement/load";
import {
  cancelSignupForm,
  deleteSignupForm,
  setSignupFormStatus,
} from "@/lib/signup-forms/actions";
import { today, totalSpots } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";
import { BackLink } from "../../../admin-parts";
import { PhaseBadge, phaseNote } from "../../form-parts";
import { FormTabs } from "../../form-tabs";
import { ShareDialog } from "../../share-dialog";
import { loadForm } from "./data";

// A signup form's admin pages: its name, day and actions, then tabs for its
// overview, volunteers, waitlist and assignments (with the travel roster).
export default async function SignupFormLayout({
  params,
  children,
}: LayoutProps<"/admin/forms/[formId]">) {
  const admin = await requireAdmin();
  const editor = canEdit(admin.role);
  const { formId } = await params;

  const form = await loadForm(formId);
  if (!form) notFound();

  const { phase } = form;
  // An event can be cancelled until its day is over. Drafts nobody signed
  // up for are deleted instead.
  const canCancel =
    editor &&
    form.status !== "CANCELLED" &&
    form.day >= today() &&
    (form.status === "PUBLISHED" || form.signupCount > 0);
  const spots = totalSpots(form.shifts);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/admin/forms">Back to forms</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{form.name}</h1>
              <PhaseBadge phase={phase} />
            </div>
            <p className="font-medium">
              {formatDay(form.day)}
              {!form.listed && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · Not on the home page: share its link with volunteers
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{phaseNote(phase, form)}</p>
            <p className="text-sm">
              {form.signupCount} {form.signupCount === 1 ? "volunteer has" : "volunteers have"} signed up
              {spots > 0 && ` of ${spots} ${spots === 1 ? "spot" : "spots"}`}
              {form.waitingCount > 0 && `, and ${form.waitingCount} ${form.waitingCount === 1 ? "is" : "are"} on the waitlist`}.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {form.status === "PUBLISHED" && <ShareDialog path={`/signup/${form.id}`} />}
            {editor && form.status !== "CANCELLED" && (
              <Link
                href={`/admin/forms/${form.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit form
              </Link>
            )}
            {editor && (
              <StatusActions
                formId={form.id}
                status={form.status}
                signupCount={form.signupCount}
              />
            )}
            {canCancel && (
              <CancelEventButton formId={form.id} />
            )}
          </div>
        </div>

        {form.description && <p className="whitespace-pre-line">{form.description}</p>}
        <QuestionsNote questions={form} />
        <FormTabs
          formId={form.id}
          confirming={form.confirming}
          volunteerCount={form.signupCount}
          waitingCount={form.waitingCount}
          waitlist={form.waitlist}
        />
      </div>

      {children}
    </div>
  );
}

// Which optional questions the form leaves out, if any.
function QuestionsNote({ questions }: { questions: FormQuestions }) {
  const off = [
    !questions.askTransportation &&
      "how volunteers are getting there (everyone gets there on their own)",
    !questions.askGroups && "friends to work with",
  ].filter((part) => typeof part === "string");
  if (off.length === 0) return null;
  return <p className="text-sm text-muted-foreground">Not asked on this form: {off.join("; ")}.</p>;
}

// Cancelling doesn't email anyone: admins contact volunteers themselves.
function CancelEventButton({ formId }: { formId: string }) {
  return (
    <ActionButton
      action={cancelSignupForm.bind(null, formId)}
      label="Cancel event"
      variant="ghost"
      confirm={{
        title: "Cancel this event?",
        description:
          "The form will say the event is cancelled, and nobody will be able to sign up. This can't be undone. Volunteers aren't emailed: download the volunteer list from the Volunteers tab to contact them.",
        confirmLabel: "Cancel event",
      }}
    />
  );
}

// Drafts can be published or deleted; published forms can be unpublished.
// A cancelled event's form stays as it is.
function StatusActions({
  formId,
  status,
  signupCount,
}: {
  formId: string;
  status: FormStatus;
  signupCount: number;
}) {
  const setStatus = (next: "DRAFT" | "PUBLISHED") => setSignupFormStatus.bind(null, formId, next);

  if (status === "CANCELLED") return null;
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
                  "Volunteers have signed up. Their signups are kept, but they won't be able to see or cancel them until the form is published again.",
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
          description: "The form, its builds and its sections will be permanently deleted.",
          confirmLabel: "Delete form",
        }}
      />
      <ActionButton action={setStatus("PUBLISHED")} label="Publish" variant="default" />
    </>
  );
}
