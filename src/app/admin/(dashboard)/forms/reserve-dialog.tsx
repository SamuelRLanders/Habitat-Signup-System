"use client";

import { LinkIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { CopyLink } from "@/components/copy-link";
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
import { Label } from "@/components/ui/label";
import { searchToReserve, type ReserveCandidate } from "@/lib/reservations/actions";
import { isVolunteerEmail, PURDUE_EMAIL_DOMAIN } from "@/lib/volunteers";
import { VolunteerSearch } from "../volunteer-search";

// A volunteer a spot is reserved for, in the form editor, by email.
export type ReservedSpot = {
  email: string;
  // They've signed up with it, so it can't be removed or moved here: it's
  // released if they cancel.
  signedUp: boolean;
};

// The "Reserve a spot" pill on a build in the form editor: finding the
// volunteer to reserve it for, or entering the Purdue email of someone who
// has never signed up. The spot is saved with the form.
// reservedEmails are everyone with a spot on the form already, who can't
// have another; on a saved form (formId), nor can anyone signed up on it.
export function ReserveDialog({
  buildName,
  reservedEmails,
  formId,
  disabled,
  onReserve,
}: {
  buildName: string;
  reservedEmails: Set<string>;
  formId: string | null;
  disabled: boolean;
  onReserve: (spot: ReservedSpot) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        <PlusIcon data-icon="inline-start" />
        Reserve a spot
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve a spot at {buildName}</DialogTitle>
          <DialogDescription>
            Find the volunteer to hold a spot for. It&apos;s saved with the form.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <ReserveForm
          reservedEmails={reservedEmails}
          formId={formId}
          onReserve={(spot) => {
            onReserve(spot);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

const TAKEN = "Already has a reserved spot on this form";

function ReserveForm({
  reservedEmails,
  formId,
  onReserve,
}: {
  reservedEmails: Set<string>;
  formId: string | null;
  onReserve: (spot: ReservedSpot) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Typing in someone who isn't found, instead of searching.
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The latest matches, by volunteer ID, to reserve the one chosen.
  const found = useRef(new Map<string, ReserveCandidate>());

  async function search(query: string) {
    const result = await searchToReserve(query, formId ?? undefined);
    found.current = new Map(result.matches.map((match) => [match.id, match]));
    return {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        blocked: reservedEmails.has(match.email) ? TAKEN : match.blocked,
      })),
    };
  }

  function reserveFound() {
    const match = selected ? found.current.get(selected) : undefined;
    if (!match) return;
    onReserve({ email: match.email, signedUp: false });
  }

  function reserveTyped(formData: FormData) {
    const spot = { email: String(formData.get("reserveEmail") ?? "").trim().toLowerCase(), signedUp: false };
    if (!/^[^\s@]+@[^\s@]+$/.test(spot.email) || !isVolunteerEmail(spot.email)) {
      return setError(`Enter their ${PURDUE_EMAIL_DOMAIN} email.`);
    }
    if (reservedEmails.has(spot.email)) return setError(`${TAKEN}.`);
    onReserve(spot);
  }

  if (typing) {
    return (
      // Not a <form>: it's inside the form editor's form.
      <div
        data-reserve
        className="flex flex-col gap-4"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          reserveTyped(fieldsOf(event.currentTarget));
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reserve-email">Purdue email</Label>
          <Input
            id="reserve-email"
            name="reserveEmail"
            type="email"
            autoComplete="off"
            autoFocus
            maxLength={254}
            placeholder={`name${PURDUE_EMAIL_DOMAIN}`}
          />
          <p className="text-sm text-muted-foreground">
            They sign up with this email to get the spot.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setTyping(false)}>
            Back to search
          </Button>
          <Button
            type="button"
            onClick={(event) => reserveTyped(fieldsOf(event.currentTarget.closest("[data-reserve]")!))}
          >
            Reserve spot
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <VolunteerSearch search={search} selected={selected} onSelect={setSelected} />
        <button
          type="button"
          onClick={() => {
            setTyping(true);
            setError(null);
          }}
          className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Not found? Enter their email
        </button>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="button" onClick={reserveFound} disabled={!selected}>
          Reserve spot
        </Button>
      </DialogFooter>
    </>
  );
}

// The typed-in fields inside an element, as FormData.
function fieldsOf(element: Element) {
  const data = new FormData();
  for (const input of element.querySelectorAll("input")) data.set(input.name, input.value);
  return data;
}

// The "Copy form link" pill by a form's reserved spots: volunteers with one
// aren't emailed, so editors send them the link.
export function FormLinkDialog({ path }: { path: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <LinkIcon data-icon="inline-start" />
        Copy form link
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send them the form&apos;s link</DialogTitle>
          <DialogDescription>
            Volunteers with a reserved spot aren&apos;t emailed. Once the form is published, they can sign up with
            this link, even before it opens.
          </DialogDescription>
        </DialogHeader>
        {/* Only mounted while open, so CopyLink can read the site's address. */}
        <CopyLink path={path} label="Signup link" />
      </DialogContent>
    </Dialog>
  );
}
