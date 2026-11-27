import type { Metadata } from "next";
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
} from "@/lib/admin/people-search";
import { listFormChoices, searchPeople } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { countPeople, getPersonDetails } from "@/lib/data/people";
import { formatPhone } from "@/lib/phone";
import { PeopleSearchBar } from "./people-search";
import { PersonDialog } from "./person-dialog";
import {
  FilterChips,
  NoResults,
  Pagination,
  ResultCount,
  SearchPrompt,
  TabHeader,
  withParam,
} from "../search-parts";
import { DialogLink } from "../url-dialog";

export const metadata: Metadata = { title: "People" };

// Everyone who has signed up through a signup form, found by searching or
// filtering through the URL, 100 at a time. Nobody is listed until there's
// a search or a filter. Clicking a name opens their details (?person=).
export default async function PeoplePage({ searchParams }: PageProps<"/admin/data/people">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const search = parsePeopleSearch(params);
  const personId = typeof params.person === "string" ? params.person : null;

  const [forms, person, everyone] = await Promise.all([
    listFormChoices(),
    personId ? getPersonDetails(personId) : null,
    countPeople(),
  ]);
  const filters = activeFilters(search, new Map(forms.map((f) => [f.value, f.label])));
  const searching = search.q !== "" || filters.length > 0;
  const results = searching ? await searchPeople(search) : null;

  const here = peopleHref(search);
  const exportQuery = toQueryString({ ...search, page: 1 });
  const csvHref = (results ? results.total : everyone) > 0
    ? `/admin/data/people/export${exportQuery ? `?${exportQuery}` : ""}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <TabHeader
        title="People"
        description={`Everyone who has signed up through a signup form, with the details from their latest signup. Download CSV saves everyone matching your search, or all ${everyone.toLocaleString("en-US")} people before you search.`}
        csvHref={csvHref}
      />

      <div className="flex flex-col gap-3">
        <PeopleSearchBar search={search} filterCount={filters.length} forms={forms} />
        <FilterChips
          chips={filters.map((filter) => ({
            label: filter.label,
            removeHref: peopleHref({ ...search, ...filter.without, page: 1 }),
          }))}
          clearHref={peopleHref(withoutFilters(search))}
        />
      </div>

      {!results ? (
        <SearchPrompt>
          {everyone === 0 ? (
            <p>Nobody has signed up yet.</p>
          ) : (
            <>
              <p className="font-medium text-foreground">Search for someone to see their details.</p>
              <p>Search by name, email or phone number, or use Filters to find a group of people.</p>
            </>
          )}
        </SearchPrompt>
      ) : results.total === 0 ? (
        <NoResults what="people" clearHref="/admin/data/people" />
      ) : (
        <>
          <ResultCount
            total={results.total}
            first={(results.page - 1) * PAGE_SIZE + 1}
            last={(results.page - 1) * PAGE_SIZE + results.people.length}
            paged={results.pageCount > 1}
          />
          <div className="hover-gold rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.people.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <DialogLink
                        href={withParam(here, "person", row.id)}
                        aria-label={`${row.firstName} ${row.lastName}: see details`}
                      >
                        {row.firstName} {row.lastName}
                      </DialogLink>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatPhone(row.phone)}</TableCell>
                    <TableCell>
                      <a href={`mailto:${row.email}`} className="hover:underline">
                        {row.email}
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {results.pageCount > 1 && (
            <Pagination
              page={results.page}
              pageCount={results.pageCount}
              previousHref={results.page > 1 ? peopleHref({ ...search, page: results.page - 1 }) : null}
              nextHref={
                results.page < results.pageCount ? peopleHref({ ...search, page: results.page + 1 }) : null
              }
            />
          )}
        </>
      )}

      {personId && (
        <PersonDialog key={personId} person={person} closeHref={here} editor={canEdit(admin.role)} />
      )}
    </div>
  );
}
