// The two steps of confirming an email address with an emailed 6-digit
// code: entering the email, then the code. Shared by admin sign-in and
// volunteers verifying their email on a signup form.

export type SendCodeState =
  | { status: "idle" }
  | {
      status: "sent";
      email: string;
      // When this response was made; each new send gets a fresh code step.
      sentAt: number;
      // Seconds before another code can be requested.
      resendAfter: number;
      // Set when no new code was sent because of the rate limit.
      notice?: string;
    }
  | { status: "error"; message: string };

export type VerifyCodeState = { error?: string };

// What to show when the rate limit stopped a new code from being sent: a
// code sent moments ago is probably in their inbox already.
export function recentCodeState(email: string, retryAfter: number): SendCodeState {
  return {
    status: "sent",
    email,
    sentAt: Date.now(),
    resendAfter: retryAfter,
    notice: `We sent a code recently, so we didn't send another yet. Use the most recent code in your inbox, or request a new one in ${formatWait(retryAfter)}.`,
  };
}

// The code as typed, allowing spaces or dashes in case it's pasted as
// "123 456", or null if it isn't 6 digits.
export function parseCode(value: FormDataEntryValue | null) {
  const code = String(value ?? "").replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
