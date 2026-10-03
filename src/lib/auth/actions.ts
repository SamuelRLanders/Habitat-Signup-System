"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/request";
import { auth } from ".";
import { takeLoginCodeRequest, RESEND_AFTER_SECONDS } from "./rate-limit";
import { ADMIN_HOME, safeNextPath } from "./redirects";

export type SendLoginCodeState =
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

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export async function sendLoginCode(
  _prev: SendLoginCodeState,
  formData: FormData,
): Promise<SendLoginCodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const email = parsed.data;

  // Only admins sign in. Saying so plainly helps a volunteer who found this
  // page, at the cost of showing whether an email belongs to an admin.
  const admin = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") {
    return {
      status: "error",
      message:
        "That email isn't an admin account. Volunteers don't need to sign in: find the signup form on the home page.",
    };
  }

  const limit = await takeLoginCodeRequest(email, await clientIp());
  if (!limit.allowed) {
    // Still show the code step: a code sent moments ago is probably in
    // their inbox already.
    return {
      status: "sent",
      email,
      sentAt: Date.now(),
      resendAfter: limit.retryAfter,
      notice: `We sent a code recently, so we didn't send another yet. Use the most recent code in your inbox, or request a new one in ${formatWait(limit.retryAfter)}.`,
    };
  }

  try {
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  } catch (error) {
    console.error("Failed to send sign-in code", error);
    return {
      status: "error",
      message: "We couldn't send a sign-in code. Please try again.",
    };
  }

  return {
    status: "sent",
    email,
    sentAt: Date.now(),
    resendAfter: RESEND_AFTER_SECONDS,
  };
}

export type VerifyLoginCodeState = { error?: string };

export async function verifyLoginCode(
  _prev: VerifyLoginCodeState,
  formData: FormData,
): Promise<VerifyLoginCodeState> {
  const email = emailSchema.safeParse(formData.get("email"));
  // Allow spaces or dashes, in case the code is pasted as "123 456".
  const code = String(formData.get("code") ?? "").replace(/[\s-]/g, "");
  if (!email.success) return { error: "Start again with your email address." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  let role: string;
  try {
    // Uses up the code and sets the session cookie. It never creates an
    // account, since sign-up is turned off.
    const result = await auth.api.signInEmailOTP({
      body: { email: email.data, otp: code },
      headers: await headers(),
    });
    // The result's user type doesn't include our role field, so look it up.
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.user.id },
      select: { role: true },
    });
    role = user.role;
  } catch (error) {
    return { error: codeErrorMessage(error) };
  }

  // Codes are only sent to admins, but someone could have lost admin access
  // since theirs was sent. getAdmin() ignores their new session.
  if (role !== "ADMIN") return { error: "That email isn't an admin account." };

  // redirect() works by throwing, so it must be outside the try/catch.
  redirect(safeNextPath(formData.get("next")) ?? ADMIN_HOME);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

function codeErrorMessage(error: unknown) {
  const code = error instanceof APIError ? error.body?.code : undefined;
  switch (code) {
    case "OTP_EXPIRED":
      return "This code has expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many incorrect tries. Request a new code.";
    case "INVALID_OTP":
      return "That code isn't right. Check your email and try again.";
    default:
      console.error("Failed to verify sign-in code", error);
      return "Something went wrong signing you in. Please try again.";
  }
}

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
