"use client";

import { UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// The "Volunteers" pill on a signup form's page: everyone who signed up,
// in a popup wide enough for the volunteer table.
export function VolunteersDialog({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UsersIcon data-icon="inline-start" />
        Volunteers ({count})
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Volunteers ({count})</DialogTitle>
          <DialogDescription>
            Everyone signed up through this form. The CSV also has their ages and
            when they signed up.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
