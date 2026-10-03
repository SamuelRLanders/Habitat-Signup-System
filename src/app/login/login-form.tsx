"use client";

import { EmailCodeForm } from "@/components/email-code-form";
import { sendLoginCode, verifyLoginCode } from "@/lib/auth/actions";
import { loginPath } from "@/lib/auth/redirects";

// Admin sign-in: an email, then the code sent to it.
export function LoginForm({ next }: { next: string | null }) {
  return (
    <EmailCodeForm
      sendAction={sendLoginCode}
      verifyAction={verifyLoginCode}
      verifyLabels={{ idle: "Sign in", pending: "Signing in…" }}
      restartHref={loginPath(next ?? undefined)}
      hiddenFields={next ? { next } : undefined}
    />
  );
}
