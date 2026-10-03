"use client";

import { useActionState, useState } from "react";
import { CopyLink } from "@/components/copy-link";
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
import { NumberField } from "@/components/ui/number-field";
import type { GroupSizeFormState } from "@/lib/me/actions";
import { submitForm } from "@/lib/submit-form";
import { MAX_GROUP_SIZE } from "@/lib/volunteers";

// The "Join link" pill on a group's card: the link to send group members.
export function JoinLinkDialog({ path }: { path: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Join link
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group join link</DialogTitle>
          <DialogDescription>
            Send this link to everyone in your group. Each person opens it and
            adds their name, birthday, and phone number.
          </DialogDescription>
        </DialogHeader>
        {/* Only rendered while open, so CopyLink can read window. */}
        <CopyLink path={path} label="Group join link" />
      </DialogContent>
    </Dialog>
  );
}

type GroupSizeAction = (
  prev: GroupSizeFormState,
  formData: FormData,
) => Promise<GroupSizeFormState>;

// The "Change group size" pill on a group's card.
export function GroupSizeDialog({
  action,
  size,
  joined,
}: {
  action: GroupSizeAction;
  size: number;
  // People who have joined through the link, shown as a hint.
  joined: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Change group size
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {/* Mounted only while open, so each opening starts fresh. */}
        <GroupSizeForm
          action={action}
          size={size}
          joined={joined}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function GroupSizeForm({
  action,
  size,
  joined,
  onSaved,
}: {
  action: GroupSizeAction;
  size: number;
  joined: number;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: GroupSizeFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.success) onSaved();
      return result;
    },
    {},
  );
  const errors = state.errors ?? {};

  return (
    <form onSubmit={submitForm(formAction)} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Change group size</DialogTitle>
        <DialogDescription>
          The new size applies to all of your group&apos;s upcoming shifts, so
          each of them needs room for everyone.
        </DialogDescription>
      </DialogHeader>
      <Field
        label="People in your group, including you"
        htmlFor="groupSize"
        error={errors.groupSize}
        hint={`${joined} ${joined === 1 ? "person has" : "people have"} joined so far.`}
      >
        <NumberField
          id="groupSize"
          name="groupSize"
          defaultValue={size}
          min={2}
          max={MAX_GROUP_SIZE}
          aria-invalid={errors.groupSize ? true : undefined}
          aria-describedby={errors.groupSize ? "groupSize-error" : undefined}
        />
      </Field>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Never mind</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
