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
import { addPendingDriver, searchDriverCandidates } from "@/lib/drivers/actions";
import { VolunteerSearch } from "../volunteer-search";

// The "Add driver" pill on the Drivers page: finding a volunteer who hasn't
// asked to drive and adding them to pending approval. They aren't
// approved here; they're checked against Purdue's list like anyone else.
export function AddDriver() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlusIcon data-icon="inline-start" />
        Add driver
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a driver</DialogTitle>
          <DialogDescription>
            Find a volunteer to add to pending approval. They still have to be
            checked against Purdue&apos;s approved driver list before
            they&apos;re approved.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <AddDriverForm onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddDriverForm({ onAdded }: { onAdded: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function add() {
    if (!selected) return;
    setError(null);
    startAdding(async () => {
      const result = await addPendingDriver(selected);
      if (result.error) setError(result.error);
      else onAdded();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <VolunteerSearch
          search={searchDriverCandidates}
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
          {adding ? "Adding…" : "Add to pending"}
        </Button>
      </DialogFooter>
    </>
  );
}
