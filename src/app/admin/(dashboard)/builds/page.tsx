import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import {
  BUILD_LIST_TABS,
  listBuilds,
  type BuildListTab,
} from "@/lib/builds/queries";
import { formatDateRange } from "@/lib/time";
import { SpotsMeter, StatusBadge } from "./build-parts";

export const metadata: Metadata = { title: "Builds" };

const tabs: Record<BuildListTab, { label: string; empty: string }> = {
  upcoming: {
    label: "Upcoming",
    empty: "No published builds have upcoming shifts.",
  },
  drafts: { label: "Drafts", empty: "No drafts." },
  past: { label: "Past", empty: "No past or cancelled builds." },
};

export default async function BuildsPage({
  searchParams,
}: PageProps<"/admin/builds">) {
  // Every admin page checks on its own. The layout's check doesn't re-run
  // when navigating between pages that share it.
  await requireAdmin();

  const { tab: tabParam } = await searchParams;
  const tab = BUILD_LIST_TABS.find((t) => t === tabParam) ?? "upcoming";
  const builds = await listBuilds(tab);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Builds</h1>
        <Link href="/admin/builds/new" className={buttonVariants()}>
          New build
        </Link>
      </div>

      <nav
        aria-label="Filter builds"
        className="flex w-fit gap-1 rounded-full bg-muted p-1"
      >
        {BUILD_LIST_TABS.map((t) => (
          <Link
            key={t}
            href={t === "upcoming" ? "/admin/builds" : `/admin/builds?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
              t === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tabs[t].label}
          </Link>
        ))}
      </nav>

      {builds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <p>{tabs[tab].empty}</p>
            {tab !== "past" && (
              <Link href="/admin/builds/new" className={buttonVariants({ variant: "outline" })}>
                Create a build
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {builds.map((build) => (
            <li key={build.id}>
              <Link
                href={`/admin/builds/${build.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{build.name}</span>
                    <StatusBadge status={build.status} />
                  </div>
                  <span className="text-sm text-muted-foreground">{build.address}</span>
                  <span className="text-sm text-muted-foreground">
                    {build.firstShiftAt && build.lastShiftAt ? (
                      <>
                        {formatDateRange(build.firstShiftAt, build.lastShiftAt, build.timeZone)}
                        {" · "}
                        {build.shiftCount} {build.shiftCount === 1 ? "shift" : "shifts"}
                      </>
                    ) : (
                      <span className="text-destructive">No shifts yet</span>
                    )}
                  </span>
                </div>
                {build.shiftCount > 0 && (
                  <SpotsMeter filled={build.filled} capacity={build.capacity} className="w-48" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
