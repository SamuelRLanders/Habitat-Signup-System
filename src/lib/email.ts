import "server-only";
import { Resend } from "resend";

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(email: Email) {
  if (!resend) {
    // Without a Resend key, print the email so flows can be tested locally.
    // Never do this in production: emails can contain login links.
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.log(
      `\n──── Email (not sent: RESEND_API_KEY is not set) ────\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n─────────────────────────────────────────────────────\n`,
    );
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const { error } = await resend.emails.send({ from, ...email });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
