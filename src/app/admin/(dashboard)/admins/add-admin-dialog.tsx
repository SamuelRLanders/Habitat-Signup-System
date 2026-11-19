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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addAdmin, type AddAdminState } from "@/lib/admins/actions";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AssignableRole } from "@/lib/auth/roles";

const roleOptions = ASSIGNABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

// The "Add admin" button on the Admins page. Adding someone emails them, so
// the dialog says so before the owner confirms.
export function AddAdminDialog({ limitNote }: { limitNote: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add admin</DialogTrigger>
      <DialogContent>
        {/* Mounted only while open, so it starts empty each time. */}
        <AddAdminForm limitNote={limitNote} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddAdminForm({ limitNote, onDone }: { limitNote: string | null; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("EDITOR");
  const [state, formAction, pending] = useActionState<AddAdminState, FormData>(async (prev, formData) => {
    const result = await addAdmin(prev, formData);
    if (result.success && !result.warning) onDone();
    return result;
  }, {});

  // Added, but the email didn't send: say so rather than closing.
  if (state.success && state.warning) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Admin added</DialogTitle>
        </DialogHeader>
        <p role="alert" className="text-sm">
          {state.warning}
        </p>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </div>
    );
  }

  const errors = state.errors ?? {};
  const shown = email.trim() || "them";
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add an admin</DialogTitle>
        <DialogDescription>
          They&apos;ll sign in with their email address and a code we email them. There&apos;s no
          password.
        </DialogDescription>
      </DialogHeader>

      <Field label="Name" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </Field>
      <Field label="Role" htmlFor="role" error={errors.role} hint={ROLE_DESCRIPTIONS[role]}>
        <Select
          name="role"
          items={roleOptions}
          value={role}
          onValueChange={(value) => value && setRole(value as AssignableRole)}
        >
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <EmailWarning limitNote={limitNote}>
        This emails {shown} to say they&apos;re now an admin, with a link to sign in.
      </EmailWarning>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" loading={pending}>
          {pending ? "Adding…" : "Add admin and email"}
        </Button>
      </DialogFooter>
    </form>
  );
}
