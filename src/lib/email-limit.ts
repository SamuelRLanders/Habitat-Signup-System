import { DEFAULT_TIME_ZONE } from "@/lib/time";

// Resend's free plan sends at most this many emails a day, counted over a
// UTC calendar day (see EmailDay). Shared with the admin pages, which warn
// before sending emails that would go past it.
export const DAILY_EMAIL_LIMIT = 100;

// A caution for an admin about to send emails that would go past today's
// limit, or null if they fit.
export function emailLimitNote(sentToday: number, sending: number) {
  const left = Math.max(DAILY_EMAIL_LIMIT - sentToday, 0);
  if (sending <= left) return null;
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const resets = midnight.toLocaleTimeString("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${sentToday} emails have been sent today, and Resend's limit is ${DAILY_EMAIL_LIMIT} a day, so ${left === 0 ? "these emails" : "some or all of these emails"} may not send. The limit resets at ${resets} Indiana time.`;
}
