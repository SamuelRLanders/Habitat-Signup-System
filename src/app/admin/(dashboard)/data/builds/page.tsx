import type { Metadata } from "next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listFormChoices } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import {
  activeBuildFilters,
  BUILD_PAGE_SIZE,
  buildQueryString,
  buildsHref,
  parseBuildSearch,
  withoutBuildFilters,
} from "@/lib/data/build-search";
import { countBuilds, getBuildDetails, listBuildAdmins, searchBuilds } from "@/lib/data/builds";
import { formatDay } from "@/lib/time";
import { BuildDialog } from "./build-dialog";
import { BuildSearchBar } from "./build-search-bar";
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

export const metadata: Metadata = { title: "Builds" };

// Every build (one day at one address), past or upcoming, found by
// searching or filtering through the URL, 100 at a time, most recent day
// first. Nothing is listed until there's a search or a filter. Clicking a
// row opens the build's details (?build=).
export default async function BuildsPage({ searchParams }: PageProps<"/admin/data/builds">) {
  await requireAdmin();
  const params = await searchParams;
  const search = parseBuildSearch(params);
  const buildId = typeof params.build === "string" ? params.build : null;

  const [forms, admins, build, everything] = await Promise.all([
    listFormChoices(),
    listBuildAdmins(),
    buildId ? getBuildDetails(buildId) : null,
    countBuilds(),
  ]);
  const filters = activeBuildFilters(
    search,
    new Map(forms.map((f) => [f.value, f.label])),
    new Map(admins.map((a) => [a.value, a.label])),
  );
  const searching = search.q !== "" || filters.length > 0;
  const results = searching ? await searchBuilds(search) : null;

  const here = buildsHref(search);
  const exportQuery = buildQueryString({ ...search, page: 1 });
  const csvHref = (results ? results.total : everything) > 0
    ? `/admin/data/builds/export${exportQuery ? `?${exportQuery}` : ""}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <TabHeader
        title="Builds"
        description={`Every build on a signup form, past or upcoming. Download CSV saves the builds matching your search, or all ${everything.toLocaleString("en-US")} builds before you search.`}
        csvHref={csvHref}
      />

      <div className="flex flex-col gap-3">
        <BuildSearchBar search={search} filterCount={filters.length} forms={forms} admins={admins} />
        <FilterChips
          chips={filters.map((filter) => ({
            label: filter.label,
            removeHref: buildsHref({ ...search, ...filter.without, page: 1 }),
          }))}
          clearHref={buildsHref(withoutBuildFilters(search))}
        />
      </div>

      {!results ? (
        <SearchPrompt>
          {everything === 0 ? (
            <p>No builds yet.</p>
          ) : (
            <>
              <p className="font-medium text-foreground">Search for a build to see its details.</p>
              <p>Search by its name, address or event, or use Filters to find upcoming or past builds.</p>
            </>
          )}
        </SearchPrompt>
      ) : results.total === 0 ? (
        <NoResults what="builds" clearHref="/admin/data/builds" />
      ) : (
        <>
          <ResultCount
            total={results.total}
            first={(results.page - 1) * BUILD_PAGE_SIZE + 1}
            last={(results.page - 1) * BUILD_PAGE_SIZE + results.builds.length}
            paged={results.pageCount > 1}
          />
          <div className="hover-gold rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Spots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.builds.map((row) => (
                  // The name's link covers the row.
                  <TableRow key={row.id} className="relative cursor-pointer">
                    <TableCell className="whitespace-nowrap">{formatDay(row.day, "short")}</TableCell>
                    <TableCell>
                      <DialogLink href={withParam(here, "build", row.id)} stretch>
                        {row.name}
                      </DialogLink>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.address}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.capacity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {results.pageCount > 1 && (
            <Pagination
              page={results.page}
              pageCount={results.pageCount}
              previousHref={results.page > 1 ? buildsHref({ ...search, page: results.page - 1 }) : null}
              nextHref={
                results.page < results.pageCount ? buildsHref({ ...search, page: results.page + 1 }) : null
              }
            />
          )}
        </>
      )}

      {buildId && <BuildDialog key={buildId} build={build} closeHref={here} />}
    </div>
  );
}
