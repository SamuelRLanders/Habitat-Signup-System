import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const CODE_MINUTES = 10;
// Wrong guesses allowed per code before a new one has to be requested.
export const CODE_ATTEMPTS = 5;

// Sign-in configuration for volunteers and admins. Everyone signs in the same
// way: enter an email, then the 6-digit code sent to it. There is no
// /api/auth route: every auth step runs through our own Server Actions
// (src/lib/auth/actions.ts), so none of Better Auth's HTTP endpoints are
// exposed.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      // input: false means sign-in can never set it. Admins are made with
      // the admin:add script.
      role: {
        type: ["VOLUNTEER", "ADMIN"],
        input: false,
        required: false,
        defaultValue: "VOLUNTEER",
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // stay logged in for 7 days...
    updateAge: 60 * 60 * 24, // ...extended at most once a day while active
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: CODE_MINUTES * 60,
      allowedAttempts: CODE_ATTEMPTS,
      storeOTP: "hashed", // a leaked database row can't be used to sign in
      // Signing in with a new email creates a volunteer account.
      disableSignUp: false,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return;
        await sendEmail({
          to: email,
          subject: `${otp} is your Habitat sign-in code`,
          text: `Your Habitat volunteer sign-in code is:\n\n${otp}\n\nThe code expires in ${CODE_MINUTES} minutes. If you didn't ask to sign in, you can ignore this email.`,
          html: `<p>Your Habitat volunteer sign-in code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>The code expires in ${CODE_MINUTES} minutes. If you didn't ask to sign in, you can ignore this email.</p>`,
        });
      },
    }),
    nextCookies(), // lets Server Actions set the session cookie; must be last
  ],
});
