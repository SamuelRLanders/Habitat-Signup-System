import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { createBuild } from "@/lib/builds/actions";
import { BuildForm } from "../build-form";
import { BackLink } from "../build-parts";

export const metadata: Metadata = { title: "New project" };

export default async function NewBuildPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/admin/builds">Back to projects</BackLink>
        <h1 className="text-2xl font-semibold">New project</h1>
        <p className="text-muted-foreground">
          Only admins see projects. You&apos;ll add builds next.
        </p>
      </div>
      <BuildForm action={createBuild} submitLabel="Create project" cancelHref="/admin/builds" />
    </div>
  );
}
