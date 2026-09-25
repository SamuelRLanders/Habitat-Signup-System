"use client";

import { ExternalLinkIcon, Share2Icon } from "lucide-react";
import { CopyLink } from "@/components/copy-link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// The "Share" pill on a published build. Shows the public signup link with a
// button to copy it.
export function ShareDialog({ path }: { path: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Share2Icon data-icon="inline-start" />
        Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share signup link</DialogTitle>
          <DialogDescription>
            Anyone with this link can see the build&apos;s shifts and sign up.
          </DialogDescription>
        </DialogHeader>
        <ShareLink path={path} />
      </DialogContent>
    </Dialog>
  );
}

// Only mounted while the dialog is open, which never happens during server
// rendering, so CopyLink can read the site's address from window.
function ShareLink({ path }: { path: string }) {
  return (
    <div className="flex flex-col gap-3">
      <CopyLink path={path} label="Signup link" />
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
      >
        <ExternalLinkIcon data-icon="inline-start" />
        Open signup page
      </a>
    </div>
  );
}
