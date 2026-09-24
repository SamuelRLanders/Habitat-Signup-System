import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const MAGIC_LINK_MINUTES = 15;

// Admin login configuration. There is no /api/auth route: every auth step
// runs through our own Server Actions (src/lib/auth/actions.ts), so none of
// Better Auth's HTTP endpoints are exposed.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: { modelName: "admin" },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // stay logged in for 7 days...
    updateAge: 60 * 60 * 24, // ...extended at most once a day while active
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_MINUTES * 60,
      disableSignUp: true, // only existing admins can log in
      storeToken: "hashed", // a leaked database row can't be used to log in
      sendMagicLink: async ({ email, token }) => {
        // Only email real admins. Callers always show the same "check your
        // email" message, so this doesn't reveal who is an admin.
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) return;

        // Link to our confirm page rather than straight to the verify step,
        // so email scanners that open links can't use up the token.
        const url = new URL("/admin/login/verify", process.env.BETTER_AUTH_URL);
        url.searchParams.set("token", token);

        await sendEmail({
          to: email,
          subject: "Your Habitat admin sign-in link",
          text: `Hi ${admin.name},\n\nClick this link to sign in to the Habitat volunteer admin dashboard:\n\n${url}\n\nThe link expires in ${MAGIC_LINK_MINUTES} minutes and can be used once. If you didn't ask to sign in, you can ignore this email.`,
          html: `<p>Hi ${escapeHtml(admin.name)},</p><p><a href="${url}">Sign in to the Habitat volunteer admin dashboard</a></p><p>The link expires in ${MAGIC_LINK_MINUTES} minutes and can be used once. If you didn't ask to sign in, you can ignore this email.</p>`,
        });
      },
    }),
    nextCookies(), // lets Server Actions set the session cookie; must be last
  ],
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
