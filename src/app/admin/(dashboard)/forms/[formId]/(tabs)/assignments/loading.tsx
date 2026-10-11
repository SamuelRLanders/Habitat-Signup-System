import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton, LoadingPage } from "../../../../skeletons";

// The Assignments tab: what the assignments are, then a column per build
// (see assignment-board.tsx).
export default function Loading() {
  return (
    <LoadingPage className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <LinesSkeleton />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}
