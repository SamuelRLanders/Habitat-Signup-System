"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// A button that shows what's behind it once clicked, such as signing in to
// cancel on a closed form, which most visitors don't need. startOpen skips
// the button, such as when coming back to start over with another email.
export function Reveal({
  label,
  startOpen = false,
  children,
}: {
  label: string;
  startOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  if (open) return children;
  return (
    <Button
      variant="outline"
      className="h-auto min-h-8 self-start py-1.5 text-left whitespace-normal"
      onClick={() => setOpen(true)}
    >
      {label}
    </Button>
  );
}
