import { MailIcon } from "lucide-react";

// Shown before an admin does something that sends email, saying who will
// get one, with any caution about the daily email limit.
export function EmailWarning({
  children,
  limitNote,
}: {
  children: React.ReactNode;
  limitNote?: string | null;
}) {
  return (
    <div role="note" className="flex gap-2.5 rounded-2xl border-l-4 border-gold bg-gold/15 px-4 py-3 text-sm">
      <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{children}</p>
        {limitNote && <p>{limitNote}</p>}
      </div>
    </div>
  );
}
