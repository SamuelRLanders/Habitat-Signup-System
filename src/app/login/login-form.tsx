"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendLoginCode,
  verifyLoginCode,
  type SendLoginCodeState,
} from "@/lib/auth/actions";
import { loginPath } from "@/lib/auth/redirects";

const initialState: SendLoginCodeState = { status: "idle" };

// Two steps: enter an email, then the code sent to it.
export function LoginForm({ next }: { next: string | null }) {
  const [state, sendAction, sending] = useActionState(
    sendLoginCode,
    initialState,
  );

  if (state.status === "sent") {
    return (
      // A new key on each send resets the code step and its countdown.
      <CodeStep
        key={state.sentAt}
        state={state}
        next={next}
        sendAction={sendAction}
        sending={sending}
      />
    );
  }

  const error = state.status === "error" ? state.message : undefined;

  return (
    <form action={sendAction} className="flex flex-col gap-4">
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
      <Button type="submit" size="lg" disabled={sending}>
        {sending ? "Sending…" : "Send code"}
      </Button>
    </form>
  );
}

function CodeStep({
  state,
  next,
  sendAction,
  sending,
}: {
  state: Extract<SendLoginCodeState, { status: "sent" }>;
  next: string | null;
  sendAction: (formData: FormData) => void;
  sending: boolean;
}) {
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyLoginCode,
    {},
  );
  const secondsLeft = useCountdown(state.resendAfter);
  const error = verifyState.error;

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        {state.notice ?? (
          <>
            We sent a code to <strong>{state.email}</strong>. It may take a
            minute to arrive.
          </>
        )}
      </p>

      <form action={verifyAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={state.email} />
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7} // room for a pasted "123 456"
            required
            autoFocus
            className="h-11 text-center font-mono text-xl tracking-[0.4em] md:text-xl"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
          />
          {error && (
            <p id="code-error" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" disabled={verifying}>
          {verifying ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <form action={sendAction}>
          <input type="hidden" name="email" value={state.email} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={sending || secondsLeft > 0}
          >
            {sending
              ? "Sending…"
              : secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : "Resend code"}
          </Button>
        </form>
        {/* A full page load resets the form. */}
        <a
          href={loginPath(next ?? undefined)}
          className="text-primary underline underline-offset-4"
        >
          Use a different email
        </a>
      </div>
    </div>
  );
}

// Counts down from the given number of seconds to zero.
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return left;
}
