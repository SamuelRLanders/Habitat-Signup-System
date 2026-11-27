import { DownloadIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Pieces shared by the Data page's People and Builds tabs.

// The tab's heading and what it shows, with its Download CSV button.
export function TabHeader({
  title,
  description,
  csvHref,
}: {
  title: string;
  description: string;
  // Null when there's nothing to download.
  csvHref: string | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex max-w-2xl flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {csvHref ? (
        // A plain link, not <Link>: it downloads a file.
        <a href={csvHref} download className={buttonVariants({ variant: "outline" })}>
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
  );
}

// The active filters as chips, each with a link that removes it, and a
// link that clears them all when there's more than one.
export function FilterChips({
  chips,
  clearHref,
}: {
  chips: { label: string; removeHref: string }[];
  clearHref: string;
}) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li
          key={chip.label}
          className="flex h-7 items-center gap-0.5 rounded-full bg-muted pr-0.5 pl-3 text-xs font-medium"
        >
          {chip.label}
          <Link
            href={chip.removeHref}
            aria-label={`Remove filter: ${chip.label}`}
            className="flex size-6 items-center justify-center hover-gold rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-3" />
          </Link>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <Link href={clearHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Clear filters
          </Link>
        </li>
      )}
    </ul>
  );
}

// Before anything is searched, the tab shows this instead of a list.
export function SearchPrompt({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 py-8 text-center text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

// A search that found nothing.
export function NoResults({ what, clearHref }: { what: string; clearHref: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
        <p>No {what} match this search.</p>
        <Link href={clearHref} className={buttonVariants({ variant: "outline" })}>
          Clear search and filters
        </Link>
      </CardContent>
    </Card>
  );
}

// "24 total results · Showing 1–100"
export function ResultCount({
  total,
  first,
  last,
  paged,
}: {
  total: number;
  first: number;
  last: number;
  paged: boolean;
}) {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      <span className="font-medium text-foreground">
        {total.toLocaleString("en-US")} total {total === 1 ? "result" : "results"}
      </span>
      {paged && (
        <>
          {" · "}Showing {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")}
        </>
      )}
    </p>
  );
}

// Previous and Next, with null for a page that doesn't exist.
export function Pagination({
  page,
  pageCount,
  previousHref,
  nextHref,
}: {
  page: number;
  pageCount: number;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const pageLink = (href: string | null, label: string) =>
    href ? (
      <Link href={href} className={buttonVariants({ variant: "outline" })}>
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
      {pageLink(previousHref, "Previous")}
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {pageLink(nextHref, "Next")}
    </nav>
  );
}

// A label and its value, in a popup's list of details.
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

// Adds or replaces one URL option on an address: withParam(href, "person", id).
export function withParam(href: string, key: string, value: string) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${path}?${params.toString()}`;
}
