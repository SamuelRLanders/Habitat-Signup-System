"use client";

import { AlertTriangleIcon, CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Purdue's travel roster, copied for an email with one button, with
// anything to check before sending it. When the browser won't copy, a
// popup shows the roster to copy by hand.
export function CopyRoster({ text, warnings }: { text: string | null; warnings: string[] }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard API needs HTTPS and permission.
      setManual(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!text} className="w-44">
          {copied ? (
            <>
              <CheckIcon data-icon="inline-start" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon data-icon="inline-start" />
              Copy travel roster
            </>
          )}
        </Button>
        <p className="text-sm text-muted-foreground">
          {text
            ? "For Purdue: who's going to each build, who's driving, and who rides with them, from the saved assignments."
            : "Nobody is going to a build yet, so there's no travel roster."}
        </p>
      </div>
      {text && warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={manual} onOpenChange={setManual}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Copy the travel roster</DialogTitle>
            <DialogDescription>
              Your browser didn&apos;t let the site copy it. The roster is selected: press Ctrl+C (or ⌘C) to copy it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text ?? ""}
            readOnly
            autoFocus
            aria-label="Travel roster"
            onFocus={(event) => event.currentTarget.select()}
            className="h-[50vh] bg-background p-4 font-mono text-xs field-sizing-fixed md:text-xs"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
