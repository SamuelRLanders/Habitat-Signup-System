import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton } from "../skeletons";

// Pieces for the Data page tabs' loading.tsx files (see ../skeletons.tsx).

// A tab's heading and description, with its Download CSV button.
export function TabHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <LinesSkeleton lines={2} />
      </div>
      <Skeleton className="h-8 w-32 shrink-0 rounded-full" />
    </div>
  );
}
