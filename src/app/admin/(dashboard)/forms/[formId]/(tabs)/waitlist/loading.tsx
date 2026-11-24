import { LinesSkeleton, LoadingPage, TableSkeleton } from "../../../../skeletons";

// The Waitlist tab: how it works, then the table.
export default function Loading() {
  return (
    <LoadingPage className="flex min-w-0 flex-col gap-4">
      <LinesSkeleton lines={2} className="w-full max-w-2xl" />
      <TableSkeleton columns={10} rows={5} />
    </LoadingPage>
  );
}
