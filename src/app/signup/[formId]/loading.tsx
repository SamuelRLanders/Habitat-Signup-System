import { PublicHeader } from "@/components/public-header";
import { Skeleton } from "@/components/ui/skeleton";

// A signup form while it loads, after clicking a build day on the home
// page: the header, then the form's panels in grey blocks.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />

      <main
        role="status"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-14"
      >
        <span className="sr-only">Loading…</span>
        <div className="flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </main>
    </div>
  );
}
