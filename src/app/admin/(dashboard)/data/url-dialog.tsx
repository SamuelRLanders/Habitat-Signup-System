"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
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

// A link that opens one of those popups, with a spinner beside it while
// the popup loads. stretch makes the whole table row (which must be
// relative) open it.
export function DialogLink({
  href,
  stretch = false,
  className,
  children,
  ...props
}: {
  href: string;
  stretch?: boolean;
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
        stretch && "after:absolute after:inset-0",
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
