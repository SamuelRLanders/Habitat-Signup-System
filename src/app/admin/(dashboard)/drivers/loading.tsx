import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "../skeletons";

// The Drivers page: title and Auto approve, then pending and approved
// drivers.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeaderSkeleton action />
      {[3, 5].map((rows) => (
        <div key={rows} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-48" />
          <TableSkeleton columns={7} rows={rows} />
        </div>
      ))}
    </LoadingPage>
  );
}
