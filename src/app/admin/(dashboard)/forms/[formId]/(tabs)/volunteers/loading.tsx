import { LinesSkeleton, LoadingPage, PillSkeleton, TableSkeleton } from "../../../../skeletons";

// The Volunteers tab: totals and Download CSV, then the table.
export default function Loading() {
  return (
    <LoadingPage className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <LinesSkeleton lines={3} className="w-full max-w-md" />
        <PillSkeleton className="w-32" />
      </div>
      <TableSkeleton columns={9} rows={8} />
    </LoadingPage>
  );
}
