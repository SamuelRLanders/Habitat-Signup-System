"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Purdue's travel roster as text, with a button to copy it into an email.
export function RosterText({ text }: { text: string }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // The clipboard API needs HTTPS and permission. Select the roster so
      // it can be copied by hand instead.
      textRef.current?.select();
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={copy} className="w-28">
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
        <p role="status" className="text-sm text-muted-foreground empty:hidden">
          {status === "failed" &&
            "Couldn't copy automatically. The roster is selected, so press Ctrl+C (or ⌘C) to copy it."}
        </p>
      </div>
      <Textarea
        ref={textRef}
        value={text}
        readOnly
        aria-label="Travel roster"
        onFocus={(event) => event.currentTarget.select()}
        className="h-[60vh] bg-background p-4 font-mono text-xs field-sizing-fixed md:text-xs"
      />
    </div>
  );
}
