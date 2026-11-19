"use client";

import { useActionState, useState } from "react";
import { EmailWarning } from "@/components/email-warning";
import { Field } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startTransfer } from "@/lib/admins/actions";
import type { ActionState } from "@/lib/forms";

type Admin = { id: string; name: string; email: string };

// The "Transfer ownership" button on the Admins page. It emails the chosen
// admin a link to accept, so the dialog says so before the owner confirms.
export function TransferDialog({ admins, limitNote }: { admins: Admin[]; limitNote: string | null }) {
  const [open, setOpen] = useState(false);

  if (admins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Add another admin first, then you can transfer to them.</p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Transfer ownership</DialogTrigger>
      <DialogContent>
        {/* Mounted only while open, so it starts fresh each time. */}
        <TransferForm admins={admins} limitNote={limitNote} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({
  admins,
  limitNote,
  onDone,
}: {
  admins: Admin[];
  limitNote: string | null;
  onDone: () => void;
}) {
  const [toId, setToId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await startTransfer(prev, formData);
    if (!result.error) onDone();
    return result;
  }, {});

  const options = admins.map((admin) => ({
    value: admin.id,
    label: admin.name ? `${admin.name} (${admin.email})` : admin.email,
  }));
  const chosen = admins.find((admin) => admin.id === toId);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Transfer ownership</DialogTitle>
        <DialogDescription>
          They&apos;ll be emailed a link, and become the owner once they open it, sign in and accept. You
          stay the owner until then, and can cancel. Once they accept, you&apos;ll be an editor.
        </DialogDescription>
      </DialogHeader>

      <Field label="New owner" htmlFor="toId">
        <Select name="toId" items={options} value={toId} onValueChange={(value) => setToId(value as string | null)}>
          <SelectTrigger id="toId" className="w-full">
            <SelectValue placeholder="Choose an admin" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <EmailWarning limitNote={limitNote}>
        This emails {chosen ? chosen.name || chosen.email : "them"} a link to accept ownership. When they
        accept, you&apos;re emailed too.
      </EmailWarning>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Never mind</DialogClose>
        <Button type="submit" loading={pending} disabled={!toId}>
          {pending ? "Sending…" : "Send transfer link"}
        </Button>
      </DialogFooter>
    </form>
  );
}
