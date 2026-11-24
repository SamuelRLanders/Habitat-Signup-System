import "server-only";
import { escapeHtml, sendEmails } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";
import { formatDay } from "@/lib/time";

// The emails about signups: to admins when a volunteer cancels after the
// form closed, and to volunteers when an admin cancels their event.
// Volunteers aren't emailed when they sign up or cancel themselves; the
// form's page shows it.

// To admins (the build's responsible admin and the owner) when a volunteer
// cancels after the form closed, when the build assignments and travel
// roster may already be set, with who's waiting for the build. Each gets
// their own copy, sent together.
export async function sendClosedFormCancellation({
  admins,
  formId,
  formName,
  day,
  volunteer,
  wasGoing,
  effects,
  custom,
  waitlist,
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
  // Who's waiting for the build they were going to ("for"), in the order
  // they joined, as "Name, email, phone, how they're getting there".
  waitlist: { for: string; people: string[] };
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
  const waitlistUrl = absoluteUrl(`/admin/forms/${formId}/waitlist`);
  const waiting =
    waitlist.people.length > 0
      ? `On the waitlist for ${waitlist.for}, in the order they joined:`
      : `Nobody is on the waitlist for ${waitlist.for}.`;
  const addThem =
    "The form has closed, so nobody is added from the waitlist automatically. Please check with the first person who can make it, then move them to the build on the Assignments tab and save. They aren't emailed.";

  await sendEmails(
    admins.map(({ to, name }) => ({
      to,
      subject: `${volunteer.name} cancelled for ${formName}, ${formatDay(day, "short")}`,
      text: [
        `Hi ${name},`,
        `${intro} ${wasGoing}`,
        assignments,
        effects.length > 0 ? `${changes}\n${effects.map((effect) => `- ${effect}`).join("\n")}` : changes,
        waitlist.people.length > 0
          ? `${waiting}\n${waitlist.people.map((person, index) => `${index + 1}. ${person}`).join("\n")}\n\n${addThem}\nWaitlist: ${waitlistUrl}`
          : waiting,
        `${roster}\n\nAssignments: ${assignmentsUrl}\nTravel roster: ${rosterUrl}`,
      ].join("\n\n"),
      html: [
        `<p>Hi ${escapeHtml(name)},</p>`,
        `<p>${escapeHtml(intro)} ${escapeHtml(wasGoing)}</p>`,
        `<p>${escapeHtml(assignments)}</p>`,
        `<p>${escapeHtml(changes)}</p>`,
        effects.length > 0 ? `<ul>${effects.map((effect) => `<li>${escapeHtml(effect)}</li>`).join("")}</ul>` : "",
        `<p>${escapeHtml(waiting)}</p>`,
        waitlist.people.length > 0
          ? `<ol>${waitlist.people.map((person) => `<li>${escapeHtml(person)}</li>`).join("")}</ol><p>${escapeHtml(addThem)} See the <a href="${waitlistUrl}">waitlist</a>.</p>`
          : "",
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
