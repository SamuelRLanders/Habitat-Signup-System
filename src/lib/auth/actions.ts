"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { auth } from ".";

export type SendLoginLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export async function sendLoginLink(
  _prev: SendLoginLinkState,
  formData: FormData,
): Promise<SendLoginLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  try {
    // Sends an email only if the address belongs to an admin (see sendMagicLink).
    await auth.api.signInMagicLink({
      body: { email: parsed.data },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Failed to send login link", error);
    return {
      status: "error",
      message: "We couldn't send a sign-in link. Please try again.",
    };
  }

  return { status: "sent", email: parsed.data };
}

export type VerifyLoginLinkState = { error?: string };

export async function verifyLoginLink(
  _prev: VerifyLoginLinkState,
  formData: FormData,
): Promise<VerifyLoginLinkState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) {
    return { error: "This sign-in link is invalid." };
  }

  try {
    // Uses up the token, creates a session, and sets the session cookie.
    await auth.api.magicLinkVerify({
      query: { token },
      headers: await headers(),
    });
  } catch {
    return {
      error: "This sign-in link has expired or was already used.",
    };
  }

  // redirect() works by throwing, so it must be outside the try/catch.
  redirect("/admin");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
