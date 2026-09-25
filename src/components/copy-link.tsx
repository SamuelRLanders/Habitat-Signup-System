"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A read-only link with a button to copy it. Pass the full url when
// rendering on the server; with only a path, it reads the site's address
// from window, so only render it in the browser (in a dialog, or after a
// form submits).
export function CopyLink({
  path,
  url: fullUrl,
  label,
}: { label: string } & ({ path: string; url?: never } | { url: string; path?: never })) {
  const url = fullUrl ?? new URL(path!, window.location.origin).toString();
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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={url}
          readOnly
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
          className="bg-background font-mono text-xs md:text-xs"
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
    </div>
  );
}
