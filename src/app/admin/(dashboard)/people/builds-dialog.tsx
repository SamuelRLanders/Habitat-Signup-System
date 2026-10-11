"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/components/field-error";
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
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { setBuilds, type BuildsState } from "@/lib/admin/actions";
import { MAX_BUILDS } from "@/lib/experience";

// The "Edit" button next to a volunteer's builds on the People page, for
// changing how many builds they've done.
export function BuildsDialog({ volunteerId, name, builds }: { volunteerId: string; name: string; builds: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Edit ${name}'s builds`} />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit builds</DialogTitle>
          <DialogDescription>
            Edit how many builds {name} has done. Builds they go on after this
            are still added automatically.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it starts from the saved number. */}
        <BuildsForm volunteerId={volunteerId} builds={builds} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BuildsForm({
  volunteerId,
  builds,
  onSaved,
}: {
  volunteerId: string;
  builds: number;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<BuildsState, FormData>(async (prev, formData) => {
    const result = await setBuilds(volunteerId, prev, formData);
    if (result.success) onSaved();
    return result;
  }, {});

  const error = state.errors?.builds;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="builds">Builds done</Label>
        <NumberField
          id="builds"
          name="builds"
          defaultValue={builds}
          min={0}
          max={MAX_BUILDS}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "builds-error" : undefined}
        />
        <FieldError field="builds" error={error} />
      </div>
      {state.errors?.form && (
        <p role="alert" className="text-sm text-destructive">
          {state.errors.form}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
