import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage } from "../../skeletons";

// The Statistics tab, under the Data page's title and tabs: the time range
// and note, the headline number and totals, then the charts.
export default function Loading() {
  return (
    <LoadingPage className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </LoadingPage>
  );
}
