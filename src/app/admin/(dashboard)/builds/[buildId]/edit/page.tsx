import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { updateBuild } from "@/lib/builds/actions";
import { prisma } from "@/lib/prisma";
import { BuildForm } from "../../build-form";
import { BackLink } from "../../build-parts";

export const metadata: Metadata = { title: "Edit build" };

export default async function EditBuildPage({
  params,
}: PageProps<"/admin/builds/[buildId]/edit">) {
  await requireAdmin();
  const { buildId } = await params;

  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: { _count: { select: { shifts: true } } },
  });
  if (!build) notFound();

  const buildHref = `/admin/builds/${build.id}`;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={buildHref}>Back to build</BackLink>
        <h1 className="text-2xl font-semibold">Edit build</h1>
      </div>
      <BuildForm
        action={updateBuild.bind(null, build.id)}
        defaults={{
          name: build.name,
          address: build.address,
          description: build.description ?? "",
          timeZone: build.timeZone,
        }}
        submitLabel="Save changes"
        cancelHref={buildHref}
        hasShifts={build._count.shifts > 0}
      />
    </div>
  );
}
