import { cn } from "cn";

// A rounded, outlined box with a short heading, for each part of the pages
// volunteers see, so a long form reads as a few clear steps.
export function Panel({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6", className)}>
      {title && (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
