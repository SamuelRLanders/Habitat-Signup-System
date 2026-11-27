import Link from "next/link";
import { LinkedText } from "@/components/linked-text";
import { Badge } from "@/components/ui/badge";
import { BUILD_STATUSES } from "@/lib/data/build-search";
import type { BuildDetails } from "@/lib/data/builds";
import { shiftTime } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";
import { Detail } from "../search-parts";
import { UrlDialog } from "../url-dialog";

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

// Everything about one build, and who went or is going there.
export function BuildDialog({
  build,
  closeHref,
}: {
  // Null when there's no such build, such as from an old link.
  build: BuildDetails | null;
  closeHref: string;
}) {
  if (!build) {
    return (
      <UrlDialog closeHref={closeHref} title="Build not found">
        <p className="text-muted-foreground">No build on the site matches this link.</p>
      </UrlDialog>
    );
  }

  const status = BUILD_STATUSES.find((s) => s.value === build.status)!.label;
  const past = build.status === "past";

  return (
    <UrlDialog
      closeHref={closeHref}
      title={build.name}
      description={`${formatDay(build.day)} · ${shiftTime(build)}`}
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail label="Event">
          <Link
            href={`/admin/forms/${build.event.id}`}
            className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {build.event.name}
          </Link>
          {build.event.status === "DRAFT" && <span className="text-muted-foreground"> (draft)</span>}
        </Detail>
        <Detail label="Status">
          <Badge variant={build.status === "upcoming" ? "default" : "secondary"}>{status}</Badge>
          {build.cancelledAt && build.event.status !== "CANCELLED" && (
            <span className="text-muted-foreground"> · build cancelled</span>
          )}
          {build.event.status === "CANCELLED" && <span className="text-muted-foreground"> · event cancelled</span>}
        </Detail>
        <Detail label="Address">{build.address}</Detail>
        <Detail label="Spots">{build.capacity}</Detail>
        <Detail label="Responsible admin">
          {build.responsible ? build.responsible.name || build.responsible.email : "Nobody"}
        </Detail>
        {build.lunch && <Detail label="Lunch">{build.lunch}</Detail>}
        {build.description && (
          <div className="sm:col-span-2">
            <Detail label="Description">
              <span className="whitespace-pre-line">
                <LinkedText text={build.description} />
              </span>
            </Detail>
          </div>
        )}
      </dl>

      <section aria-labelledby="build-volunteers" className="flex flex-col gap-2">
        <h3 id="build-volunteers" className="font-medium">
          Volunteers
        </h3>
        {build.status === "cancelled" ? (
          <p className="text-muted-foreground">Nobody went: this build was cancelled.</p>
        ) : build.event.status === "DRAFT" ? (
          <p className="text-muted-foreground">
            Its event&apos;s form is a draft, so volunteers can&apos;t see it or sign up.
          </p>
        ) : build.assigned !== null ? (
          <>
            <p className="text-muted-foreground">
              {past ? "Went" : "Assigned"}: {plural(build.assigned, "volunteer", "volunteers")} of{" "}
              {plural(build.capacity, "spot", "spots")}
              {build.volunteerHours !== null &&
                ` · ${Math.round(build.volunteerHours).toLocaleString("en-US")} volunteer hours`}
              {past && build.assigned > 0 && " (attendance isn't taken, so everyone placed here counts)"}.
            </p>
            {build.volunteers.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/10">
                {build.volunteers.map((volunteer) => (
                  <li key={volunteer.id} className="px-3 py-1.5">
                    <Link
                      href={`/admin/data/people?person=${volunteer.id}`}
                      className="hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {volunteer.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            {plural(build.chose, "signed-up volunteer", "signed-up volunteers")}{" "}
            {build.chose === 1 ? "says" : "say"} they could work here. Who goes is
            settled once the form closes; the event&apos;s page shows the likely
            placement.
          </p>
        )}
        {build.waiting > 0 && build.status !== "cancelled" && (
          <p className="text-muted-foreground">
            {plural(build.waiting, "volunteer", "volunteers")}{" "}
            {past
              ? build.waiting === 1
                ? "was still on the waitlist for this build."
                : "were still on the waitlist for this build."
              : build.waiting === 1
                ? "is on the waitlist for this build."
                : "are on the waitlist for this build."}
          </p>
        )}
      </section>
    </UrlDialog>
  );
}
