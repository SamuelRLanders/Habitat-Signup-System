import "server-only";
import { escapeHtml, sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";
import { shiftLabel, type OfferedShift } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";

// Emails to volunteers about their signup. Each links back to the form,
// where they confirm their email again to update or cancel.

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
  updated,
}: SignupEmail & { shifts: OfferedShift[]; updated: boolean }) {
  const date = formatDay(day);
  const url = absoluteUrl(`/signup/${formId}`);
  const intro = updated
    ? `Your signup for the Purdue Habitat build day on ${date} is updated.`
    : `Thanks for signing up for the Purdue Habitat build day on ${date}!`;
  const lines = shifts.map(shiftLabel);

  await sendEmail({
    to,
    subject: updated ? `Your signup for ${formatDay(day, "short")} is updated` : `You're signed up for ${formatDay(day, "short")}`,
    text: [
      `Hi ${firstName},`,
      intro,
      `You said you could work at:\n${lines.map((line) => `- ${line}`).join("\n")}`,
      "We'll let you know which build you're placed at.",
      `To update or cancel your signup, go to ${url} and confirm your email.`,
    ].join("\n\n"),
    html: [
      `<p>Hi ${escapeHtml(firstName)},</p>`,
      `<p>${escapeHtml(intro)}</p>`,
      `<p>You said you could work at:</p>`,
      `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
      `<p>We'll let you know which build you're placed at.</p>`,
      `<p>To update or cancel your signup, <a href="${url}">go to the signup form</a> and confirm your email.</p>`,
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
