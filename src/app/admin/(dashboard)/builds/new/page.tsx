import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { createBuild } from "@/lib/builds/actions";
import { BuildForm } from "../build-form";
import { BackLink } from "../build-parts";

export const metadata: Metadata = { title: "New build" };

export default async function NewBuildPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/admin/builds">Back to builds</BackLink>
        <h1 className="text-2xl font-semibold">New build</h1>
        <p className="text-muted-foreground">
          New builds start as drafts that only admins can see. You&apos;ll add
          shifts next, then publish the build to open signups.
        </p>
      </div>
      <BuildForm action={createBuild} submitLabel="Create build" cancelHref="/admin/builds" />
    </div>
  );
}
