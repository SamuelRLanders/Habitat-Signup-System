import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "../skeletons";

// The People page: title and Download CSV, the search bar, the count,
// then the table.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeaderSkeleton action lines={1} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-8 w-full sm:w-36" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <Skeleton className="h-4 w-32" />
      <TableSkeleton columns={9} rows={10} />
    </LoadingPage>
  );
}
