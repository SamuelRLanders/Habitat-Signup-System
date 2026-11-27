import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, TableSkeleton } from "../../skeletons";
import { TabHeaderSkeleton } from "../tab-skeletons";

// The People tab, under the Data page's title and tabs: its heading and
// Download CSV, the search bar, then the results.
export default function Loading() {
  return (
    <LoadingPage className="flex flex-col gap-6">
      <TabHeaderSkeleton />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-8 w-full sm:w-36" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <TableSkeleton columns={3} rows={6} />
    </LoadingPage>
  );
}
