import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PersonDetails } from "@/lib/data/people";
import { EXPERIENCE_LABELS, experienceOf } from "@/lib/experience";
import { formatPhone } from "@/lib/phone";
import { today } from "@/lib/signup-forms/queries";
import { DEFAULT_TIME_ZONE, formatDate, formatDay, toDay } from "@/lib/time";
import { ageOn, seatsLabel, shirtLabel } from "@/lib/volunteers";
import { Detail } from "../search-parts";
import { UrlDialog } from "../url-dialog";
import { BuildsDialog } from "./builds-dialog";

// Everything about one volunteer, from their latest signup, and every event
// they signed up for. Editors can change how many builds they've done.
export function PersonDialog({
  person,
  closeHref,
  editor,
}: {
  // Null when there's no such person, such as from an old link.
  person: PersonDetails | null;
  closeHref: string;
  editor: boolean;
}) {
  if (!person) {
    return (
      <UrlDialog closeHref={closeHref} title="Person not found">
        <p className="text-muted-foreground">Nobody on the site matches this link.</p>
      </UrlDialog>
    );
  }

  const name = `${person.firstName} ${person.lastName}`;
  const driver =
    person.driver.status === "approved"
      ? `Approved through ${formatDay(person.driver.until, "short")}`
      : person.driver.status === "pending"
        ? "Waiting for approval"
        : "Not approved";

  return (
    <UrlDialog closeHref={closeHref} title={name} description="Details from their latest signup.">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail label="Email">
          <a href={`mailto:${person.email}`} className="break-all hover:underline">
            {person.email}
          </a>
        </Detail>
        <Detail label="Phone">{formatPhone(person.phone)}</Detail>
        <Detail label="Age">
          {ageOn(person.dateOfBirth, today())}{" "}
          <span className="text-muted-foreground">(born {formatDay(toDay(person.dateOfBirth), "short")})</span>
        </Detail>
        <Detail label="T-shirt">{shirtLabel(person.tShirtSize)}</Detail>
        <Detail label="Driver's license">{person.hasDriversLicense ? "Yes" : "No"}</Detail>
        <Detail label="Purdue driver approval">{driver}</Detail>
        {person.carSeats !== null && <Detail label="Car">{seatsLabel(person.carSeats)}</Detail>}
        <Detail label="Experience">
          <span className="flex items-center gap-1">
            {EXPERIENCE_LABELS[experienceOf(person.builds)]} ·{" "}
            {person.builds === 0 ? "no builds" : `${person.builds} ${person.builds === 1 ? "build" : "builds"}`}
            {editor && <BuildsDialog volunteerId={person.id} name={name} builds={person.builds} />}
          </span>
        </Detail>
        <Detail label="No-shows">
          {person.noShows === 0 ? "None" : person.noShows}
          <span className="text-muted-foreground"> (didn&apos;t come or cancel)</span>
        </Detail>
        <Detail label="First signed up">{formatDate(person.createdAt, DEFAULT_TIME_ZONE)}</Detail>
        <Detail label="Details last changed">{formatDate(person.updatedAt, DEFAULT_TIME_ZONE)}</Detail>
      </dl>

      <section aria-labelledby="person-events" className="flex flex-col gap-2">
        <h3 id="person-events" className="font-medium">
          Events ({person.signups.length})
        </h3>
        {person.signups.length === 0 ? (
          <p className="text-muted-foreground">No signups.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/10">
            {person.signups.map((signup) => (
              <li key={signup.id} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/admin/forms/${signup.formId}`}
                    className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {signup.event}
                  </Link>
                  <Badge
                    variant={
                      signup.status === "Went" || signup.status === "Assigned"
                        ? "default"
                        : signup.status === "No-show"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {signup.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDay(signup.day, "short")}
                  {signup.build && (signup.status === "No-show" ? ` · Missed ${signup.build}` : ` · ${signup.build}`)}
                  {signup.added && " · Added by an admin on the day"}
                  {signup.chose.length > 0 && ` · Could work at ${signup.chose.join(", ")}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </UrlDialog>
  );
}
