"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
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
import { addToConfirmed, searchToAdd } from "@/lib/signup-forms/attendance-actions";
import { VolunteerSearch } from "../../../../volunteer-search";

// The "Add volunteer" pill on the confirmed assignments: finding someone
// who came without signing up (or after cancelling) and adding them to Not
// placed, to move to the build they went to. Nobody is emailed.
export function AddVolunteer({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlusIcon data-icon="inline-start" />
        Add volunteer
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add someone who came</DialogTitle>
          <DialogDescription>
            Find a volunteer who came without signing up. They&apos;re added to
            Not placed: then move them to the build they went to and save.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <AddVolunteerForm formId={formId} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddVolunteerForm({ formId, onAdded }: { formId: string; onAdded: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function add() {
    if (!selected) return;
    setError(null);
    startAdding(async () => {
      const result = await addToConfirmed(formId, selected);
      if (result.error) setError(result.error);
      else onAdded();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <VolunteerSearch
          search={(query) => searchToAdd(formId, query)}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            setError(null);
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={add} disabled={!selected} loading={adding}>
          {adding ? "Adding…" : "Add to Not placed"}
        </Button>
      </DialogFooter>
    </>
  );
}
