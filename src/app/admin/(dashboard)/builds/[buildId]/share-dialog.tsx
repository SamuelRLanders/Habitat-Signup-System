"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, Share2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
// rendering, so it can read the site's address from window.
function ShareLink({ path }: { path: string }) {
  const url = new URL(path, window.location.origin).toString();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // The clipboard API needs HTTPS and permission. Select the link so it
      // can be copied by hand instead.
      inputRef.current?.select();
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={url}
          readOnly
          aria-label="Signup link"
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs md:text-xs"
        />
        <Button type="button" onClick={copy} className="w-24 shrink-0">
          {status === "copied" ? (
            <>
              <CheckIcon data-icon="inline-start" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon data-icon="inline-start" />
              Copy
            </>
          )}
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {status === "failed" && "Couldn't copy automatically. The link is selected, so press Ctrl+C (or ⌘C) to copy it."}
      </p>
      <a
        href={url}
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
