import "server-only";
import { Resend } from "resend";
import { DAILY_EMAIL_LIMIT } from "@/lib/email-limit";
import { prisma } from "@/lib/prisma";
import { addDays, DEFAULT_TIME_ZONE, formatDateTime, fromDay, toDay } from "@/lib/time";

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Every email sent is counted against Resend's daily limit (see EmailDay),
// and when the day's count reaches WARN_AT, the operations lead is emailed
// once.
const WARN_AT = 90;
export const OPERATIONS_LEAD = "landers2@purdue.edu";

// The most emails Resend takes in one batch request.
const BATCH_SIZE = 100;

export async function sendEmail(email: Email) {
  await sendEmails([email]);
}

// Sends several emails, in as few requests as Resend allows.
export async function sendEmails(emails: Email[]) {
  if (emails.length === 0) return;
  if (!resend) {
    // Without a Resend key, print the emails so flows can be tested locally.
    // Never do this in production: emails can contain sign-in codes.
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    for (const email of emails) {
      console.log(
        `\n──── Email (not sent: RESEND_API_KEY is not set) ────\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n─────────────────────────────────────────────────────\n`,
      );
    }
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE).map((email) => ({ from, ...email }));
    const { error } =
      batch.length === 1 ? await resend.emails.send(batch[0]) : await resend.batch.send(batch);
    if (error) throw new Error(`Failed to send email: ${error.message}`);
    await countSent(batch.length);
  }
}

// Today, as Resend counts its daily limit.
function utcToday() {
  return fromDay(toDay(new Date()));
}

// How many emails have been sent today, for admins about to send more.
export async function emailsSentToday() {
  const today = await prisma.emailDay.findUnique({ where: { day: utcToday() } });
  return today?.sent ?? 0;
}

// Adds sent emails to today's count, and warns the operations lead the
// first time it reaches WARN_AT. The emails are already sent, so a failure
// here is only logged.
async function countSent(count: number) {
  const day = utcToday();
  try {
    const { sent } = await prisma.emailDay.upsert({
      where: { day },
      create: { day, sent: count },
      update: { sent: { increment: count } },
    });
    if (sent < WARN_AT) return;

    // Claimed by setting warnedAt, so only one request sends the warning.
    // The warning counts too, but by then warnedAt is set.
    const { count: claimed } = await prisma.emailDay.updateMany({
      where: { day, warnedAt: null },
      data: { warnedAt: new Date() },
    });
    if (claimed === 0) return;
    try {
      await sendEmail(limitWarning(sent, day));
    } catch (error) {
      // Let the next email try again.
      await prisma.emailDay.update({ where: { day }, data: { warnedAt: null } });
      throw error;
    }
  } catch (error) {
    console.error("Failed to count emails sent today", error);
  }
}

function limitWarning(sent: number, day: Date) {
  const resets = formatDateTime(fromDay(addDays(toDay(day), 1)), DEFAULT_TIME_ZONE);
  const lines = [
    `The Purdue Habitat signup system has sent ${sent} emails today, close to Resend's limit of ${DAILY_EMAIL_LIMIT} a day.`,
    `Once it's reached, no more emails go out until the limit resets at ${resets} (Indiana time). That includes sign-in codes for admins and volunteers, so volunteers won't be able to sign up or cancel.`,
    "To send more, upgrade the Resend plan, or hold off on cancelling events or approving drivers until it resets.",
  ];
  return {
    to: OPERATIONS_LEAD,
    subject: `Purdue Habitat has sent ${sent} of ${DAILY_EMAIL_LIMIT} emails today`,
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
  };
}

// Makes text safe to put inside an HTML email.
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
