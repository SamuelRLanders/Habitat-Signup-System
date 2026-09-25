import "server-only";
import { escapeHtml, sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/request";

// Emails sent to volunteers about their signups.

export async function sendSignupConfirmation({
  to,
  firstName,
  build,
  size,
  shifts,
  waiverPath,
}: {
  to: string;
  firstName: string;
  build: { name: string; address: string };
  size: number;
  shifts: { date: string; time: string }[];
  waiverPath: string | null;
}) {
  const dashboardUrl = absoluteUrl("/me");
  const waiverUrl = waiverPath ? absoluteUrl(waiverPath) : null;
  const intro =
    size > 1
      ? `Thanks for bringing a group of ${size} to ${build.name}. Your group is signed up for:`
      : `Thanks for volunteering at ${build.name}. You're signed up for:`;
  const shiftLines = shifts.map((shift) => `${shift.date}, ${shift.time}`);

  const groupText = waiverUrl
    ? `\n\nEveryone else in your group needs to sign the waiver before the build. Send them this link:\n\n${waiverUrl}\n\nYou can see who has signed on your signups page.`
    : "";
  const groupHtml = waiverUrl
    ? `<p><strong>Everyone else in your group needs to sign the waiver before the build.</strong> Send them this link:</p><p><a href="${waiverUrl}">${waiverUrl}</a></p><p>You can see who has signed on your signups page.</p>`
    : "";

  await sendEmail({
    to,
    subject: `You're signed up to volunteer at ${build.name}`,
    text: `Hi ${firstName},\n\n${intro}\n\n${shiftLines.map((line) => `- ${line}`).join("\n")}\n\nAddress: ${build.address}${groupText}\n\nTo see or cancel your signups, visit ${dashboardUrl}`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(intro)}</p><ul>${shiftLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>Address: ${escapeHtml(build.address)}</p>${groupHtml}<p><a href="${dashboardUrl}">See or cancel your signups</a></p>`,
  });
}
