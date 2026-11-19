import "server-only";
import { escapeHtml, sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";
import { ROLE_LABELS, type AssignableRole } from "@/lib/auth/roles";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/time";

// Emails about admin access, all set off by the owner on the Admins page
// (or by accepting a transfer). Each is warned about before it's sent.

type Person = { email: string; name: string };

function nameOf(person: Person) {
  return person.name || person.email;
}

function paragraphs(lines: string[], links: Record<string, string> = {}) {
  return lines
    .map((line) => {
      let html = escapeHtml(line);
      for (const [url, text] of Object.entries(links)) {
        html = html.replace(escapeHtml(url), `<a href="${url}">${escapeHtml(text)}</a>`);
      }
      return `<p>${html}</p>`;
    })
    .join("");
}

const ROLE_INTROS: Record<AssignableRole, string> = {
  EDITOR: "As an editor, you can see and change signup forms, signups, build assignments, people and drivers.",
  VIEWER: "As a viewer, you can see the admin pages and download their data, but you can't change anything.",
};

// To someone the owner just made an admin.
export async function sendAdminAdded({ to, role, owner }: { to: Person; role: AssignableRole; owner: Person }) {
  const loginUrl = absoluteUrl("/login");
  const lines = [
    `Hi ${nameOf(to)},`,
    `${nameOf(owner)} added you as an admin on the Purdue Habitat volunteer signup site. ${ROLE_INTROS[role]}`,
    `To sign in, go to ${loginUrl} and enter this email address. We'll email you a code; there's no password.`,
    "If you weren't expecting this, you can ignore this email, or let the Purdue Habitat organizers know.",
  ];
  await sendEmail({
    to: to.email,
    subject: `You're now a Purdue Habitat admin (${ROLE_LABELS[role].toLowerCase()})`,
    text: lines.join("\n\n"),
    html: paragraphs(lines, { [loginUrl]: loginUrl }),
  });
}

// To the admin the owner wants to hand the site over to, with the link to
// accept. Nothing changes unless they accept.
export async function sendTransferLink({
  to,
  owner,
  token,
  expiresAt,
}: {
  to: Person;
  owner: Person;
  token: string;
  expiresAt: Date;
}) {
  const url = absoluteUrl(`/admin/transfer/${token}`);
  const expires = formatDateTime(expiresAt, DEFAULT_TIME_ZONE);
  const lines = [
    `Hi ${nameOf(to)},`,
    `${nameOf(owner)} wants to make you the owner of the Purdue Habitat volunteer signup site. The owner manages who the admins are, and gets the email when the site is close to its daily email limit.`,
    `To accept, open ${url}, sign in as ${to.email} if you're asked to, and choose Accept ownership. Nothing changes until you do. Once you accept, ${nameOf(owner)} becomes an editor.`,
    `The link works until ${expires} (Indiana time). If you don't want to be the owner, you can ignore this email.`,
  ];
  await sendEmail({
    to: to.email,
    subject: "Accept ownership of the Purdue Habitat signup site",
    text: lines.join("\n\n"),
    html: paragraphs(lines, { [url]: "this link" }),
  });
}

// To the old owner, once the new owner has accepted.
export async function sendTransferDone({ to, newOwner }: { to: Person; newOwner: Person }) {
  const lines = [
    `Hi ${nameOf(to)},`,
    `${nameOf(newOwner)} (${newOwner.email}) accepted ownership of the Purdue Habitat volunteer signup site, so they're now the owner, and you're now an editor.`,
    "If you didn't mean for this to happen, ask them to transfer ownership back to you.",
  ];
  await sendEmail({
    to: to.email,
    subject: `${nameOf(newOwner)} is now the owner of the Purdue Habitat signup site`,
    text: lines.join("\n\n"),
    html: paragraphs(lines),
  });
}
