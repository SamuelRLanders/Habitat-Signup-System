"use client";

import { CarIcon, CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// The "Travel roster" pill on a signup form's page: Purdue's roster of who's
// going to each build and who's driving whom, ready to copy into an email.
// It follows the likely placement, so it shows anything to check first.
export function TravelRosterDialog({ text, warnings }: { text: string; warnings: string[] }) {
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
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CarIcon data-icon="inline-start" />
        Travel roster
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Travel roster</DialogTitle>
          <DialogDescription>
            For Purdue: who&apos;s going to each build, who&apos;s driving, and who rides
            with them. It follows the likely placement, so it changes as people sign up
            and cancel. Send it once signups close.
          </DialogDescription>
        </DialogHeader>
        {warnings.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 rounded-2xl border-l-4 border-gold bg-gold/15 py-3 pr-5 pl-10 text-sm">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <Textarea
          ref={textRef}
          value={text}
          readOnly
          aria-label="Travel roster"
          onFocus={(event) => event.currentTarget.select()}
          className="h-[60vh] bg-background p-4 font-mono text-xs field-sizing-fixed md:text-xs"
        />
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
      </DialogContent>
    </Dialog>
  );
}
