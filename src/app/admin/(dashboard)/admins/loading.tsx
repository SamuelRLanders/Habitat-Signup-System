import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton, TableSkeleton } from "../skeletons";

// The Admins page: title and Add admin, the admins, then ownership.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-4xl flex-col gap-8">
      <PageHeaderSkeleton action />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <TableSkeleton columns={5} rows={3} />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </LoadingPage>
  );
}
