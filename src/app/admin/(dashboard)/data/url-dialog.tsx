"use client";

import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The People and Builds tabs' popups open from the address (?person= or
// ?build=), as Next.js suggests for dialogs, so the page loads what's in
// one on the server, and the back button closes it. Closing it goes to
// closeHref: the same search without it. Give it a key, such as the
// person's ID, so each one starts open.
export function UrlDialog({
  closeHref,
  title,
  description,
  children,
}: {
  closeHref: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Closes at once, while the address catches up.
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        router.replace(closeHref, { scroll: false });
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// A table row that opens one of those popups when it's clicked anywhere,
// except on a link or button in it (such as an email address), or when
// text in it is being selected. It's highlighted on hover and ends with a
// chevron, so it reads as clickable. Keyboard users open the popup with
// the DialogLink in the row, so the row itself isn't a tab stop. Give it
// one more column than the rows above it (see DialogRowHead).
export function DialogRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <TableRow
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        if (window.getSelection()?.toString()) return;
        startTransition(() => router.push(href, { scroll: false }));
      }}
      className={cn("group cursor-pointer hover:bg-gold/10", pending && "bg-gold/10")}
    >
      {children}
      <TableCell className="w-8 pr-3 text-right">
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="ml-auto size-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronRightIcon
            aria-hidden="true"
            className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        )}
      </TableCell>
    </TableRow>
  );
}

// The header cell above DialogRow's chevrons.
export function DialogRowHead() {
  return (
    <TableHead className="w-8">
      <span className="sr-only">Details</span>
    </TableHead>
  );
}

// A link that opens one of those popups, with a spinner beside it while
// the popup loads.
export function DialogLink({
  href,
  className,
  children,
  ...props
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      // Not one popup's data per row ahead of time.
      prefetch={false}
      className={cn(
        "rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <span className="relative">
        {children}
        <Pending />
      </span>
    </Link>
  );
}

// Always there, so the row doesn't shift when it shows.
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <LoaderCircleIcon
      aria-hidden="true"
      className={cn(
        "absolute top-1/2 -right-5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground opacity-0 transition-opacity",
        pending && "opacity-100",
      )}
    />
  );
}
