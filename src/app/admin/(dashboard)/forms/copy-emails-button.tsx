"use client";

import { CheckIcon, MailIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The "Copy emails" pill on a build, once its form has closed: the emails
// of the volunteers going there, separated by commas, ready to paste into
// an email's To or Bcc field.
export function CopyEmailsButton({ emails, buildName }: { emails: string[]; buildName: string }) {
  const list = emails.join(", ");
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(list);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // The clipboard API needs HTTPS and permission. Show the list,
      // selected, so it can be copied by hand instead.
      setStatus("failed");
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        aria-label={`Copy the emails of the ${emails.length} volunteers going to ${buildName}`}
      >
        {status === "copied" ? (
          <>
            <CheckIcon data-icon="inline-start" />
            Copied {emails.length}
          </>
        ) : (
          <>
            <MailIcon data-icon="inline-start" />
            Copy emails ({emails.length})
          </>
        )}
      </Button>
      {status === "failed" && (
        <div className="flex w-72 max-w-full flex-col gap-1">
          <Input
            ref={inputRef}
            value={list}
            readOnly
            aria-label={`Emails of volunteers going to ${buildName}`}
            onFocus={(event) => event.currentTarget.select()}
            className="bg-background font-mono text-xs md:text-xs"
          />
          <p role="status" className="text-xs text-muted-foreground">
            Couldn&apos;t copy automatically. The emails are selected, so press Ctrl+C (or ⌘C).
          </p>
        </div>
      )}
    </div>
  );
}
