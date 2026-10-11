import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

// Pieces for the admin pages' loading.tsx files, which Next.js shows the
// moment a link is clicked, until the page's data has loaded. Each mirrors
// its page's layout in grey blocks, so the page doesn't jump when it
// arrives.

// Wraps a page's skeleton. Screen readers hear "Loading" instead of the
// blocks, which are hidden from them.
export function LoadingPage({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

// A button-sized pill, such as "Back to forms" or "Download CSV".
export function PillSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-7 w-24 rounded-full", className)} />;
}

// Lines of text, the last one shorter, like a paragraph.
export function LinesSkeleton({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

// A page's title, with an optional button beside it, and its description.
export function PageHeaderSkeleton({ action = false, lines = 2 }: { action?: boolean; lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        {action && <Skeleton className="h-8 w-28 rounded-full" />}
      </div>
      <LinesSkeleton lines={lines} className="max-w-2xl" />
    </div>
  );
}

const CELL_WIDTHS = ["w-28", "w-40", "w-24", "w-16", "w-20", "w-32"];

// A table in the admin pages' outlined box: a header row, then rows of cells.
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  const cells = Array.from({ length: columns }, (_, i) => CELL_WIDTHS[i % CELL_WIDTHS.length]);
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="flex gap-6 border-b px-3 py-3">
        {cells.map((width, i) => (
          <Skeleton key={i} className={cn("h-3.5 shrink-0", width)} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-6 border-b px-3 py-3 last:border-b-0">
          {cells.map((width, i) => (
            <Skeleton key={i} className={cn("h-4 shrink-0", width)} />
          ))}
        </div>
      ))}
    </div>
  );
}
