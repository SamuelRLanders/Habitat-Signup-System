"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/form-fields";
import { Input } from "@/components/ui/input";

// Whether a scrolling box is at (or within a few pixels of) its end.
function atEnd(box: HTMLElement) {
  return box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
}

// The waiver text in a scrolling box, then a box to type your full legal
// name to agree to it. The name box unlocks once the waiver has been
// scrolled to the end (or right away, if it fits without scrolling). Also
// sends the waiver's ID, so the server can check it's still the current
// version.
export function WaiverSignature({
  waiver,
  field,
  error,
}: {
  waiver: { id: string; title: string; body: string };
  field: string;
  error?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);

  // A short waiver, or a tall screen, may show the whole text at once. The
  // observer also calls back once when it starts watching.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => {
      if (atEnd(box)) setReadToEnd(true);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const hint = readToEnd
    ? "By typing your full legal name, you agree to the waiver above. This is your signature."
    : "Scroll to the end of the waiver to sign it.";

  return (
    <>
      <input type="hidden" name="waiverId" value={waiver.id} />
      <div
        ref={boxRef}
        onScroll={(event) => {
          if (atEnd(event.currentTarget)) setReadToEnd(true);
        }}
        tabIndex={0}
        role="region"
        aria-label={waiver.title}
        className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm ring-1 ring-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <h3 className="font-semibold">{waiver.title}</h3>
        <p className="whitespace-pre-line">{waiver.body}</p>
      </div>
      <Field label="Full legal name" htmlFor={field} error={error} hint={hint}>
        {/* readOnly rather than disabled, so the field is still sent and
            the server can say what's missing. */}
        <Input
          id={field}
          name={field}
          autoComplete="name"
          required
          readOnly={!readToEnd}
          placeholder={readToEnd ? undefined : "Read the waiver first"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${field}-error` : undefined}
          className="read-only:cursor-not-allowed read-only:bg-muted/50"
        />
      </Field>
    </>
  );
}
