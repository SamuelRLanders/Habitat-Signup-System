"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendLoginLink, type SendLoginLinkState } from "@/lib/auth/actions";

const initialState: SendLoginLinkState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    sendLoginLink,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-4 text-sm">
        <p>
          If <strong>{state.email}</strong> belongs to an admin account, a
          sign-in link is on its way. Check your inbox.
        </p>
        {/* A full page load resets the form. */}
        <a href="/admin/login" className="text-primary underline underline-offset-4">
          Use a different email
        </a>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
