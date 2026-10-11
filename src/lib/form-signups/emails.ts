import "server-only";
import { escapeHtml, sendEmail, sendEmails } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";
import { shiftLabel, type OfferedShift } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";

// Emails to volunteers about their signup. Each links back to the form,
// where they confirm their email again to cancel.

type SignupEmail = {
  to: string;
  firstName: string;
  formId: string;
  day: string; // "2026-10-10"
};

export async function sendSignupConfirmation({
  to,
  firstName,
  formId,
  day,
  shifts,
}: SignupEmail & { shifts: OfferedShift[] }) {
  const date = formatDay(day);
  const url = absoluteUrl(`/signup/${formId}`);
  const intro = `Thanks for signing up for the Purdue Habitat build day on ${date}!`;
  const lines = shifts.map(shiftLabel);

  await sendEmail({
    to,
    subject: `You're signed up for ${formatDay(day, "short")}`,
    text: [
      `Hi ${firstName},`,
      intro,
      `You said you could work at:\n${lines.map((line) => `- ${line}`).join("\n")}`,
      "We'll let you know which build you're placed at.",
      `To cancel your signup, go to ${url} and confirm your email. To make changes, cancel and sign up again.`,
    ].join("\n\n"),
    html: [
      `<p>Hi ${escapeHtml(firstName)},</p>`,
      `<p>${escapeHtml(intro)}</p>`,
      `<p>You said you could work at:</p>`,
      `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
      `<p>We'll let you know which build you're placed at.</p>`,
      `<p>To cancel your signup, <a href="${url}">go to the signup form</a> and confirm your email. To make changes, cancel and sign up again.</p>`,
    ].join(""),
  });
}

export async function sendCancellation({ to, firstName, formId, day }: SignupEmail) {
  const date = formatDay(day);
  const url = absoluteUrl(`/signup/${formId}`);
  const body = `Your signup for the Purdue Habitat build day on ${date} is cancelled.`;

  await sendEmail({
    to,
    subject: `Your signup for ${formatDay(day, "short")} is cancelled`,
    text: `Hi ${firstName},\n\n${body}\n\nChanged your mind? While the form is open, you can sign up again at ${url}.`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(body)}</p><p>Changed your mind? While the form is open, you can <a href="${url}">sign up again</a>.</p>`,
  });
}

// To everyone signed up for a day when an admin cancels its event, sent
// together.
export async function sendEventCancelled(
  day: string,
  volunteers: { to: string; firstName: string }[],
) {
  const date = formatDay(day);
  const url = absoluteUrl("/");
  const body = `The Purdue Habitat build day on ${date} has been cancelled, so your signup for it is cancelled too. You don't need to do anything.`;
  const sorry = "We're sorry for the change of plans, and hope to see you at another build day.";

  await sendEmails(
    volunteers.map(({ to, firstName }) => ({
      to,
      subject: `The build day on ${formatDay(day, "short")} is cancelled`,
      text: `Hi ${firstName},\n\n${body}\n\n${sorry} See upcoming build days at ${url}.`,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(body)}</p><p>${escapeHtml(sorry)} <a href="${url}">See upcoming build days</a>.</p>`,
    })),
  );
}
