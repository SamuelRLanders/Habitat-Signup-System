import type { Metadata } from "next";
import { listResponsibleAdmins } from "@/lib/admins/queries";
import { requireEditorPage } from "@/lib/auth/dal";
import { createSignupForm } from "@/lib/signup-forms/actions";
import { BackLink } from "../../admin-parts";
import { FormEditor } from "../form-editor";

export const metadata: Metadata = { title: "New signup form" };

export default async function NewSignupFormPage() {
  const admin = await requireEditorPage("/admin/forms/new", "/admin/forms");
  const admins = await listResponsibleAdmins();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/admin/forms">Back to forms</BackLink>
        <h1 className="text-2xl font-semibold">New signup form</h1>
        <p className="text-muted-foreground">
          Add the day&apos;s builds, then save. New forms start as drafts
          that only admins can see. Publish it when it&apos;s ready, then
          share its link with volunteers.
        </p>
      </div>
      <FormEditor
        action={createSignupForm}
        admins={admins}
        adminId={admin.id}
        submitLabel="Create form"
        cancelHref="/admin/forms"
      />
    </div>
  );
}
