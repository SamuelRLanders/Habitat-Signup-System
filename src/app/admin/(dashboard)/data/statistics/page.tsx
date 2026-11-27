import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/dal";
import { getStatistics, type Statistics } from "@/lib/data/statistics";
import { parseStatsRange } from "@/lib/data/stats-range";
import { EXPERIENCE_LABELS } from "@/lib/experience";
import { today } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";
import { BarList, ColumnChart, percent } from "./charts";
import { RangePicker } from "./range-picker";

export const metadata: Metadata = { title: "Statistics" };

const count = (value: number, one: string, many: string) =>
  `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
const volunteers = (value: number) => count(value, "volunteer", "volunteers");
const people = (value: number) => count(value, "person", "people");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The club's numbers for a time range (in the URL), from the events in it
// that are over.
export default async function StatisticsPage({ searchParams }: PageProps<"/admin/data/statistics">) {
  await requireAdmin();
  const range = parseStatsRange(await searchParams, today());
  const stats = await getStatistics(range);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <RangePicker range={range} />
        <p className="flex max-w-3xl gap-2 text-sm text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Counts events that are over. Everyone at a build on an event&apos;s
            confirmed assignments is counted as having gone: admins mark
            no-shows and add anyone who came without signing up there. Until
            they do, everyone placed is counted.
          </span>
        </p>
      </div>

      {stats.eventCount === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No events in {range.preset === "all" ? "the club's history" : "this range"} are over yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <Headline stats={stats} />

          <ChartCard
            title="Ages on the build day"
            description="Each time someone went on a build counts once, at their age that day."
          >
            <ColumnChart
              title="Volunteers by age on the build day"
              rows={stats.ages.map(({ age, count }) => ({
                key: String(age),
                label: String(age),
                value: count,
                name: `Age ${age}`,
              }))}
              unit={volunteers}
              tickEvery={stats.ages.length > 24 ? 5 : stats.ages.length > 12 ? 2 : 1}
            />
          </ChartCard>

          {stats.months.length > 1 && (
            <ChartCard title="Volunteers each month" description="Spots filled at the month's events.">
              <ColumnChart
                title="Volunteers each month"
                rows={stats.months.map(({ month, count }, index) => {
                  const [year, number] = month.split("-").map(Number);
                  const short = MONTHS[number - 1];
                  return {
                    key: month,
                    // The year on January and the first month.
                    label: number === 1 || index === 0 ? `${short} ${String(year).slice(2)}` : short,
                    value: count,
                    name: `${short} ${year}`,
                  };
                })}
                unit={volunteers}
                tickEvery={stats.months.length > 18 ? 3 : 1}
              />
            </ChartCard>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ChartCard
              title="Getting to the site"
              description={`What volunteers said on their signup. ${count(stats.approvedDrivers, "volunteer is", "volunteers are")} approved to drive today.`}
            >
              <BarList
                title="How volunteers got to the site"
                rows={stats.transport.map((row) => ({
                  key: row.kind,
                  label: row.label,
                  name: row.label,
                  value: row.count,
                }))}
                unit={volunteers}
              />
            </ChartCard>
            <ChartCard
              title="Experience"
              description="How experienced the people who volunteered are now, from the builds they've done."
            >
              <BarList
                title="Experience levels"
                rows={stats.experience.map((row) => ({
                  key: row.level,
                  label: EXPERIENCE_LABELS[row.level],
                  name: EXPERIENCE_LABELS[row.level],
                  value: row.count,
                }))}
                unit={people}
              />
            </ChartCard>
            <ChartCard title="T-shirt sizes" description="Each person who volunteered, by their latest size.">
              <BarList
                title="T-shirt sizes"
                rows={stats.sizes.map((row) => ({ key: row.label, label: row.label, name: row.label, value: row.count }))}
                unit={people}
              />
            </ChartCard>
            <ChartCard title="Most builds" description="Who went on the most builds in this range.">
              <TopVolunteers top={stats.top} />
            </ChartCard>
          </div>

          <EventsTable events={stats.events} />
        </>
      )}
    </div>
  );
}

// The headline number, then the other totals.
function Headline({ stats }: { stats: Statistics }) {
  const tiles = [
    {
      label: "Spots filled",
      value: stats.went,
      note: `of ${stats.spots.toLocaleString("en-US")} spots · ${percent(stats.went, stats.spots)} full`,
    },
    { label: "Volunteer hours", value: Math.round(stats.hours), note: "from each build's times" },
    { label: "Events", value: stats.eventCount, note: count(stats.buildCount, "build", "builds") },
    { label: "New volunteers", value: stats.newPeople, note: "first build with the club" },
    { label: "Returning volunteers", value: stats.returning, note: "had been on a build before" },
    {
      label: "Cancellations",
      value: stats.cancelled,
      note: `${percent(stats.cancelled, stats.signedUp)} of signups`,
    },
    { label: "Left on the waitlist", value: stats.waiting, note: "still waiting on the day" },
    {
      label: "No-shows",
      value: stats.noShows,
      note: `didn't come or cancel · ${percent(stats.noShows, stats.went + stats.noShows)} of those placed`,
    },
  ];

  return (
    <section aria-label="Totals" className="flex flex-col gap-4">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">People who volunteered</span>
        <span className="text-5xl font-semibold">{stats.people.toLocaleString("en-US")}</span>
        <span className="text-sm text-muted-foreground">
          at {count(stats.eventCount, "event", "events")} that {stats.eventCount === 1 ? "is" : "are"} over
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-0.5 rounded-xl p-3 ring-1 ring-foreground/10">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="text-2xl font-semibold">{tile.value.toLocaleString("en-US")}</dd>
            <dd className="text-xs text-muted-foreground">{tile.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TopVolunteers({ top }: { top: Statistics["top"] }) {
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {top.map((person, index) => (
        <li key={person.id} className="flex items-baseline gap-3">
          <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">{index + 1}</span>
          <Link
            href={`/admin/data/people?person=${person.id}`}
            className="min-w-0 flex-1 truncate hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {person.name}
          </Link>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {count(person.builds, "build", "builds")} · {Math.round(person.hours)} hrs
          </span>
        </li>
      ))}
    </ol>
  );
}

// Each event in the range, most recent first, and how full it was.
function EventsTable({ events }: { events: Statistics["events"] }) {
  return (
    <section aria-labelledby="events-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="events-heading" className="font-semibold">
          Events
        </h2>
        <p className="text-sm text-muted-foreground">How full each event was, most recent first.</p>
      </div>
      <div className="hover-gold rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="text-right">Builds</TableHead>
              <TableHead className="text-right">Went</TableHead>
              <TableHead>Full</TableHead>
              <TableHead className="text-right">No-shows</TableHead>
              <TableHead className="text-right">Waitlist</TableHead>
              <TableHead className="text-right">Cancelled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const full = event.spots === 0 ? 0 : Math.min(1, event.went / event.spots);
              return (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{formatDay(event.day, "short")}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/forms/${event.id}`}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {event.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{event.builds}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {event.went} / {event.spots}
                  </TableCell>
                  <TableCell>
                    {/* A meter: the filled share of the spots. */}
                    <div className="flex items-center gap-2">
                      <div
                        role="meter"
                        aria-label={`${event.name}: ${percent(event.went, event.spots)} full`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(full * 100)}
                        className="h-2 w-20 overflow-hidden rounded-full bg-chart-bar/20"
                      >
                        <div className="h-full rounded-full bg-chart-bar" style={{ width: `${full * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {percent(event.went, event.spots)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{event.noShows}</TableCell>
                  <TableCell className="text-right tabular-nums">{event.waiting}</TableCell>
                  <TableCell className="text-right tabular-nums">{event.cancelled}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
