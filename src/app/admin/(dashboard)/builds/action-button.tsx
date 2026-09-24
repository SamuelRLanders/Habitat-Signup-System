"use client";

import { useActionState, useState } from "react";
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
import type { ActionState } from "@/lib/builds/actions";

type Action = (prev: ActionState) => Promise<ActionState>;
type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

type ActionButtonProps = {
  action: Action;
  label: string;
  variant?: Variant;
  size?: "default" | "sm";
  // When set, asks for confirmation in a dialog before running the action.
  confirm?: { title: string; description: string; confirmLabel: string };
};

// A button that runs a Server Action, such as "Publish" or "Cancel shift",
// and shows the action's error message if it returns one.
export function ActionButton({ confirm, ...props }: ActionButtonProps) {
  if (confirm) return <ConfirmButton confirm={confirm} {...props} />;

  return <DirectButton {...props} />;
}

function DirectButton({
  action,
  label,
  variant = "outline",
  size = "sm",
}: Omit<ActionButtonProps, "confirm">) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {label}
      </Button>
      {state.error && (
        <p role="alert" className="max-w-xs text-right text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ConfirmButton({
  action,
  label,
  variant = "outline",
  size = "sm",
  confirm,
}: ActionButtonProps & { confirm: NonNullable<ActionButtonProps["confirm"]> }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>
        {label}
      </DialogTrigger>
      <DialogContent>
        {/* Mounted only while open, so an old error doesn't reappear. */}
        <ConfirmForm
          action={action}
          confirm={confirm}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConfirmForm({
  action,
  confirm,
  onDone,
}: {
  action: Action;
  confirm: NonNullable<ActionButtonProps["confirm"]>;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState) => {
      const result = await action(prev);
      if (!result.error) onDone();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{confirm.title}</DialogTitle>
        <DialogDescription>{confirm.description}</DialogDescription>
      </DialogHeader>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          Never mind
        </DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Working…" : confirm.confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
