import "server-only";
import { escapeHtml, sendEmail, sendEmails } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";
import { shiftLabel, type OfferedShift } from "@/lib/signup-forms/queries";
import { formatDay } from "@/lib/time";

// Emails to volunteers about their signup. Each links back to the form,
// where they confirm their email again to cancel. And one to admins, when a
// volunteer cancels after the form closed.

type SignupEmail = {
  to: string;
  firstName: string;
  formId: string;
  formName: string; // "Purdue Habitat build day"
  day: string; // "2026-10-10"
};

export async function sendSignupConfirmation({
  to,
  firstName,
  formId,
  formName,
  day,
  shifts,
}: SignupEmail & { shifts: OfferedShift[] }) {
  const date = formatDay(day);
  const url = absoluteUrl(`/signup/${formId}`);
  const intro = `Thanks for signing up for ${formName} on ${date}!`;
  const lines = shifts.map(shiftLabel);

  await sendEmail({
    to,
    subject: `You're signed up for ${formName}, ${formatDay(day, "short")}`,
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

export async function sendCancellation({ to, firstName, formId, formName, day }: SignupEmail) {
  const date = formatDay(day);
  const url = absoluteUrl(`/signup/${formId}`);
  const body = `Your signup for ${formName} on ${date} is cancelled.`;

  await sendEmail({
    to,
    subject: `Your signup for ${formName}, ${formatDay(day, "short")} is cancelled`,
    text: `Hi ${firstName},\n\n${body}\n\nChanged your mind? While the form is open, you can sign up again at ${url}.`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(body)}</p><p>Changed your mind? While the form is open, you can <a href="${url}">sign up again</a>.</p>`,
  });
}

// To admins (the form's creator and the operations lead) when a volunteer
// cancels after the form closed, when the build assignments and travel
// roster may already be set. Each gets their own copy, sent together.
export async function sendClosedFormCancellation({
  admins,
  formId,
  formName,
  day,
  volunteer,
  wasGoing,
  effects,
  custom,
}: {
  admins: { to: string; name: string }[];
  formId: string;
  formName: string;
  day: string;
  volunteer: { name: string; email: string };
  // "They were assigned to Ash, driving 3 others."
  wasGoing: string;
  // From cancellationEffects() (src/lib/placement/cancellation.ts).
  effects: string[];
  custom: boolean;
}) {
  const date = formatDay(day);
  const assignmentsUrl = absoluteUrl(`/admin/forms/${formId}/assignments`);
  const rosterUrl = absoluteUrl(`/admin/forms/${formId}/travel-roster`);
  const intro = `${volunteer.name} (${volunteer.email}) cancelled their signup for ${formName} on ${date}, after the form closed.`;
  const assignments = custom
    ? "They've been taken off the custom assignments; nobody else was moved."
    : "The app's placement has been updated without them.";
  const changes =
    effects.length > 0
      ? "What this changes for travel:"
      : "Nobody else's build or ride changes because of this.";
  const roster = "If you've already sent Purdue the travel roster, send the updated one.";

  await sendEmails(
    admins.map(({ to, name }) => ({
      to,
      subject: `${volunteer.name} cancelled for ${formName}, ${formatDay(day, "short")}`,
      text: [
        `Hi ${name},`,
        `${intro} ${wasGoing}`,
        assignments,
        effects.length > 0 ? `${changes}\n${effects.map((effect) => `- ${effect}`).join("\n")}` : changes,
        `${roster}\n\nAssignments: ${assignmentsUrl}\nTravel roster: ${rosterUrl}`,
      ].join("\n\n"),
      html: [
        `<p>Hi ${escapeHtml(name)},</p>`,
        `<p>${escapeHtml(intro)} ${escapeHtml(wasGoing)}</p>`,
        `<p>${escapeHtml(assignments)}</p>`,
        `<p>${escapeHtml(changes)}</p>`,
        effects.length > 0 ? `<ul>${effects.map((effect) => `<li>${escapeHtml(effect)}</li>`).join("")}</ul>` : "",
        `<p>${escapeHtml(roster)} See the <a href="${assignmentsUrl}">assignments</a> and the <a href="${rosterUrl}">travel roster</a>.</p>`,
      ].join(""),
    })),
  );
}

// To everyone signed up through a form when an admin cancels its event,
// sent together.
export async function sendEventCancelled(
  formName: string,
  day: string,
  volunteers: { to: string; firstName: string }[],
) {
  const date = formatDay(day);
  const url = absoluteUrl("/");
  const body = `${formName} on ${date} has been cancelled, so your signup for it is cancelled too. You don't need to do anything.`;
  const sorry = "We're sorry for the change of plans, and hope to see you at another build day.";

  await sendEmails(
    volunteers.map(({ to, firstName }) => ({
      to,
      subject: `${formName}, ${formatDay(day, "short")} is cancelled`,
      text: `Hi ${firstName},\n\n${body}\n\n${sorry} See upcoming build days at ${url}.`,
      html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(body)}</p><p>${escapeHtml(sorry)} <a href="${url}">See upcoming build days</a>.</p>`,
    })),
  );
}
