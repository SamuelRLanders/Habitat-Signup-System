import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage } from "../skeletons";

// The Help page: title, the CONTEXT.md card, then the GitHub card.
export default function Loading() {
  return (
    <LoadingPage className="mx-auto flex max-w-3xl flex-col gap-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </LoadingPage>
  );
}
