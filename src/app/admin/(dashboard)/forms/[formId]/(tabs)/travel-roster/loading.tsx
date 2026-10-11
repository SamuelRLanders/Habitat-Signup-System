import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton, LoadingPage } from "../../../../skeletons";

// The Travel roster tab: its note, the Copy button, then the roster.
export default function Loading() {
  return (
    <LoadingPage className="flex max-w-3xl flex-col gap-4">
      <LinesSkeleton lines={3} />
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </LoadingPage>
  );
}
