"use server";

import { takeLoginCodeRequest, RESEND_AFTER_SECONDS } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email";
import {
  parseCode,
  recentCodeState,
  type SendCodeState,
  type VerifyCodeState,
} from "@/lib/email-code";
import { emailSchema } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/request";
import { cancelDeadline } from "@/lib/form-signups/queries";
import { formPhase } from "@/lib/signup-forms/phase";
import { offeredShifts } from "@/lib/signup-forms/queries";
import { formatDay, toDay } from "@/lib/time";
import { isVolunteerEmail, PURDUE_EMAIL_DOMAIN } from "@/lib/volunteers";
import {
  checkCode,
  CODE_MINUTES,
  createCode,
  endSession,
  startSession,
} from "./session";

// Volunteers confirming their email address on a signup form. Only Purdue
// emails can be used. Anyone can call these, so codes are only sent while a
// form is open, or after it closes for cancelling until the day's first
// shift. The same rate limits as admin sign-in apply.

const NOT_PURDUE = `Use your Purdue email, ending in ${PURDUE_EMAIL_DOMAIN}.`;

export async function sendSignupCode(
  formId: string,
  _prev: SendCodeState,
  formData: FormData,
): Promise<SendCodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const email = parsed.data;
  if (!isVolunteerEmail(email)) return { status: "error", message: NOT_PURDUE };

  const form = await prisma.signupForm.findUnique({
    where: { id: formId, status: "PUBLISHED" },
    select: { date: true, status: true, opensAt: true, closesAt: true },
  });
  if (!form || !(await canUseForm(form))) {
    return {
      status: "error",
      message: "This form isn't taking signups right now. Refresh the page to see why.",
    };
  }

  const limit = await takeLoginCodeRequest(email, await clientIp());
  if (!limit.allowed) return recentCodeState(email, limit.retryAfter);

  const day = formatDay(toDay(form.date));
  try {
    const code = await createCode(email);
    await sendEmail({
      to: email,
      subject: `${code} is your Purdue Habitat signup code`,
      text: `Your Purdue Habitat code for the build day on ${day} is:\n\n${code}\n\nThe code expires in ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Your Purdue Habitat code for the build day on ${day} is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>The code expires in ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p>`,
    });
  } catch (error) {
    console.error("Failed to send signup code", error);
    return { status: "error", message: "We couldn't send a code. Please try again." };
  }

  return { status: "sent", email, sentAt: Date.now(), resendAfter: RESEND_AFTER_SECONDS };
}

// Open, or closed but with its first shift still to come, so volunteers
// can cancel.
async function canUseForm(form: Parameters<typeof formPhase>[0] & { date: Date }) {
  const phase = formPhase(form);
  if (phase === "open") return true;
  if (phase !== "closed") return false;
  const day = toDay(form.date);
  const shifts = (await offeredShifts([day])).get(day) ?? [];
  return new Date() < cancelDeadline(day, shifts);
}

const codeErrors = {
  wrong: "That code isn't right. Check your email and try again.",
  expired: "This code has expired or was already used. Request a new one.",
  "too-many": "Too many incorrect tries. Request a new code.",
} as const;

// On success the email is remembered on this browser, and the page shows
// the rest of the form.
export async function verifySignupCode(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = parseCode(formData.get("code"));
  if (!email.success) return { error: "Start again with your email address." };
  if (!isVolunteerEmail(email.data)) return { error: NOT_PURDUE };
  if (!code) return { error: "Enter the 6-digit code." };

  const result = await checkCode(email.data, code);
  if (result !== "ok") return { error: codeErrors[result] };

  await startSession(email.data);
  return {};
}

// "Not you?": forgets the verified email on this browser.
export async function forgetVerifiedEmail() {
  await endSession();
}
