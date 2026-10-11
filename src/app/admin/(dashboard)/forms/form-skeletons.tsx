import { Skeleton } from "@/components/ui/skeleton";
import { LinesSkeleton, PillSkeleton } from "../skeletons";

// Skeletons of the signup form pages, for their loading.tsx files.

// The top of a form's page (see [formId]/(tabs)/layout.tsx): back pill,
// name and badge, day, notes, action pills, then the tabs.
export function FormHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <PillSkeleton className="w-32" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-60 max-w-full" />
        </div>
        <div className="flex gap-2">
          <PillSkeleton className="w-20" />
          <PillSkeleton />
          <PillSkeleton className="w-20" />
        </div>
      </div>
      <Skeleton className="h-9 w-96 max-w-full rounded-full" />
    </div>
  );
}

// The Overview tab: a heading, its note, and a box per build with the
// spots meter on the right.
export function BuildsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-20" />
        <LinesSkeleton className="max-w-3xl" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-xl p-4 ring-1 ring-foreground/10">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex w-32 flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// The new and edit form pages: back pill, title, then the form's fields
// (see form-editor.tsx).
export function EditorSkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <PillSkeleton className="w-32" />
        <Skeleton className="h-8 w-64" />
        <LinesSkeleton />
      </div>
      {["w-12", "w-20", "w-48", "w-24"].map((label, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className={`h-4 ${label}`} />
          <Skeleton className={i === 3 ? "h-24 w-full" : "h-8 w-full"} />
        </div>
      ))}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}
