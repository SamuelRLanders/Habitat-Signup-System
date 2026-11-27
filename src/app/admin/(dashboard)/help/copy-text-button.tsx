"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// The Help page's "Copy text" pill: CONTEXT.md's text, for pasting into an
// AI assistant's chat rather than attaching the file.
export function CopyTextButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // The clipboard API needs HTTPS and permission.
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" onClick={copy} className="w-fit">
        {status === "copied" ? (
          <>
            <CheckIcon data-icon="inline-start" />
            Copied
          </>
        ) : (
          <>
            <CopyIcon data-icon="inline-start" />
            Copy text
          </>
        )}
      </Button>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {status === "failed" && "Couldn't copy automatically. Download the file instead."}
      </p>
    </div>
  );
}
