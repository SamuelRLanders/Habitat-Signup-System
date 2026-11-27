import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton, LoadingPage, PageHeaderSkeleton } from "../skeletons";

// The Help page: title, the CONTEXT.md card and how to use it, then GitHub.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeaderSkeleton lines={1} />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <LinesSkeleton lines={5} />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </LoadingPage>
  );
}
