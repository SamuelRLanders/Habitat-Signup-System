import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { BuildStatus } from "@/generated/prisma/enums";

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

// Only cancelled builds get a badge; active is the usual case.
export function StatusBadge({ status }: { status: BuildStatus }) {
  if (status !== "CANCELLED") return null;
  return <Badge variant="destructive">Cancelled</Badge>;
}

// "6 / 10 spots filled" with a bar underneath.
export function SpotsMeter({
  filled,
  capacity,
  className,
}: {
  filled: number;
  capacity: number;
  className?: string;
}) {
  const percent = capacity > 0 ? Math.min(100, (filled / capacity) * 100) : 0;
  const full = capacity > 0 && filled >= capacity;

  return (
    <div className={cn("flex min-w-32 flex-col gap-1", className)}>
      <span className="text-sm tabular-nums">
        {filled} / {capacity} spots filled
        {full && <span className="font-medium"> · Full</span>}
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
