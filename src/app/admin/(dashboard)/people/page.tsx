import { DownloadIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activeFilters,
  PAGE_SIZE,
  parsePeopleSearch,
  peopleHref,
  toQueryString,
  withoutFilters,
  type PeopleSearch,
} from "@/lib/admin/people-search";
import { searchPeople } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPhone } from "@/lib/phone";
import { DEFAULT_TIME_ZONE, formatDate, toDateInput } from "@/lib/time";
import { ageOn, SEX_OPTIONS, T_SHIRT_SIZES } from "@/lib/volunteers";
import { PeopleSearchBar } from "./people-search";

export const metadata: Metadata = { title: "People" };

// Everyone with an account, searched and filtered through the URL, 100 at
// a time. Group members who only signed a waiver through a group link don't
// have accounts, so they appear on shift rosters instead.
export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  await requireAdmin();

  const search = parsePeopleSearch(await searchParams);
  const { total, page, pageCount, people } = await searchPeople(search);
  const filters = activeFilters(search);
  const searching = search.q !== "" || filters.length > 0;
  const today = toDateInput(new Date(), DEFAULT_TIME_ZONE);

  const exportQuery = toQueryString({ ...search, page: 1 });
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + people.length - 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who has signed in. Group members who signed a waiver through
            a group link are listed on each shift&apos;s volunteer list.
          </p>
        </div>
        {total > 0 ? (
          // A plain link, not <Link>: it downloads a file.
          <a
            href={`/admin/people/export${exportQuery ? `?${exportQuery}` : ""}`}
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon aria-hidden="true" />
            Download CSV
          </a>
        ) : (
          <Button variant="outline" disabled>
            <DownloadIcon aria-hidden="true" />
            Download CSV
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <PeopleSearchBar search={search} filterCount={filters.length} />

        {filters.length > 0 && (
          <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
            {filters.map((filter) => (
              <li
                key={filter.label}
                className="flex h-7 items-center gap-0.5 rounded-full bg-muted pr-0.5 pl-3 text-xs font-medium"
              >
                {filter.label}
                <Link
                  href={peopleHref({ ...search, ...filter.without, page: 1 })}
                  aria-label={`Remove filter: ${filter.label}`}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <XIcon className="size-3" />
                </Link>
              </li>
            ))}
            {filters.length > 1 && (
              <li>
                <Link
                  href={peopleHref(withoutFilters(search))}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Clear filters
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            {searching ? (
              <>
                <p>No one matches this search.</p>
                <Link href="/admin/people" className={buttonVariants({ variant: "outline" })}>
                  Clear search and filters
                </Link>
              </>
            ) : (
              <p>Nobody has signed in yet.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground">
              {total.toLocaleString("en-US")} total {total === 1 ? "result" : "results"}
            </span>
            {pageCount > 1 && (
              <>
                {" · "}Showing {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")}
              </>
            )}
          </p>

          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>T-shirt</TableHead>
                  <TableHead className="text-right">Upcoming shifts</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-2">
                        {person.name || (
                          <span className="font-normal text-muted-foreground">
                            No details yet
                          </span>
                        )}
                        {person.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <a href={`mailto:${person.email}`} className="hover:underline">
                        {person.email}
                      </a>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {person.profile ? (
                        <>
                          {formatPhone(person.profile.phone)}
                          {person.profile.smsOptIn && (
                            <span className="block text-xs text-muted-foreground">Texts OK</span>
                          )}
                        </>
                      ) : (
                        <Blank />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.profile ? ageOn(person.profile.dateOfBirth, today) : <Blank />}
                    </TableCell>
                    <TableCell>
                      {labelOf(SEX_OPTIONS, person.profile?.sex) ?? <Blank />}
                    </TableCell>
                    <TableCell>
                      {labelOf(T_SHIRT_SIZES, person.profile?.tShirtSize) ?? <Blank />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.upcomingShifts}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(person.createdAt, DEFAULT_TIME_ZONE)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && <Pagination search={search} page={page} pageCount={pageCount} />}
        </>
      )}
    </div>
  );
}

function Pagination({
  search,
  page,
  pageCount,
}: {
  search: PeopleSearch;
  page: number;
  pageCount: number;
}) {
  const pageLink = (to: number, label: string) =>
    to >= 1 && to <= pageCount ? (
      <Link
        href={peopleHref({ ...search, page: to })}
        className={buttonVariants({ variant: "outline" })}
      >
        {label}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")}
      >
        {label}
      </span>
    );

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4">
      {pageLink(page - 1, "Previous")}
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {pageLink(page + 1, "Next")}
    </nav>
  );
}

function Blank() {
  return <span className="text-muted-foreground">—</span>;
}

function labelOf<T extends string>(options: { value: T; label: string }[], value?: T | null) {
  return options.find((option) => option.value === value)?.label;
}
