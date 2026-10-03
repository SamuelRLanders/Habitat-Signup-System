import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { createSignupForm } from "@/lib/signup-forms/actions";
import { BackLink } from "../../builds/build-parts";
import { FormEditor } from "../form-editor";

export const metadata: Metadata = { title: "New signup form" };

// ?date=2026-10-10 fills in the build day, for the link on a build's page.
export default async function NewSignupFormPage({
  searchParams,
}: PageProps<"/admin/forms/new">) {
  await requireAdmin();
  const { date } = await searchParams;
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/admin/forms">Back to forms</BackLink>
        <h1 className="text-2xl font-semibold">New signup form</h1>
        <p className="text-muted-foreground">
          New forms start as drafts that only admins can see. Publish it when
          it&apos;s ready, then share its link with volunteers.
        </p>
      </div>
      <FormEditor
        action={createSignupForm}
        defaults={{ date: day }}
        submitLabel="Create form"
        cancelHref="/admin/forms"
      />
    </div>
  );
}
