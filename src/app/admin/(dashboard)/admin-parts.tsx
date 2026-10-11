import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

// A pill at the top of a page that goes up one level.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
    >
      {children}
    </Link>
  );
}

// "6 willing · 10 spots" with a bar underneath. Willing means volunteers
// who said on the signup form that they could work at the build; a
// volunteer can be willing to work at several.
export function SpotsMeter({
  willing,
  capacity,
  className,
}: {
  willing: number;
  capacity: number;
  className?: string;
}) {
  const percent = capacity > 0 ? Math.min(100, (willing / capacity) * 100) : 0;

  return (
    <div className={cn("flex min-w-32 flex-col gap-1", className)}>
      <span className="text-sm tabular-nums">
        {willing} willing · {capacity} {capacity === 1 ? "spot" : "spots"}
      </span>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
