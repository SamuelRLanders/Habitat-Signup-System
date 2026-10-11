import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, PageHeaderSkeleton } from "../skeletons";

// The signup forms list while it loads: title, Upcoming/Past, then forms.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeaderSkeleton action />
      <Skeleton className="h-9 w-44 rounded-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}
