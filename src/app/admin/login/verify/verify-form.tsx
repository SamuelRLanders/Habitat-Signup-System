"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { verifyLoginLink } from "@/lib/auth/actions";

export function VerifyForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(verifyLoginLink, {});

  if (state.error) {
    return (
      <div role="alert" className="flex flex-col gap-4 text-sm">
        <p>{state.error}</p>
        <a href="/admin/login" className="text-primary underline underline-offset-4">
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
