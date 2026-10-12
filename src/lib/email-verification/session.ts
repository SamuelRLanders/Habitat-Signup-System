import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Volunteers confirming their email address on a signup form: a 6-digit
// code, then a short session on that browser. Volunteers don't have
// accounts; this is separate from the admins' Better Auth sign-in.

export const CODE_MINUTES = 10;
// Wrong guesses allowed per code before a new one has to be requested.
const CODE_ATTEMPTS = 5;
// Short, so a verified email isn't left behind on a shared computer.
export const SESSION_HOURS = 2;

const COOKIE = "volunteer_session";

// Codes and tokens are stored hashed, so a leaked database row can't be used.
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Makes a new code for the email, replacing any earlier one, and returns it
// to be emailed.
export async function createCode(email: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.volunteerCode.deleteMany({
      where: { OR: [{ email }, { expiresAt: { lt: new Date() } }] },
    }),
    prisma.volunteerCode.create({
      data: {
        email,
        codeHash: hash(code),
        expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
      },
    }),
  ]);
  return code;
}

export type CodeCheck = "ok" | "wrong" | "expired" | "too-many";

// Checks a code against the email's latest one, counting every try. A right
// code is used up.
export async function checkCode(email: string, code: string): Promise<CodeCheck> {
  const latest = await prisma.volunteerCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.expiresAt < new Date()) return "expired";

  // Use up a try before comparing, in one statement that only succeeds while
  // tries are left. Postgres makes updates to the same row take turns, so
  // however many guesses arrive at the same moment, only CODE_ATTEMPTS of
  // them are compared. (Reading the count first, then adding to it after a
  // wrong guess, would let them all through before any was counted.)
  const { count } = await prisma.volunteerCode.updateMany({
    where: { id: latest.id, attempts: { lt: CODE_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (count === 0) {
    // Out of tries, or the code was used or replaced in the meantime.
    const current = await prisma.volunteerCode.findUnique({
      where: { id: latest.id },
      select: { expiresAt: true },
    });
    return current && current.expiresAt >= new Date() ? "too-many" : "expired";
  }

  const matches = timingSafeEqual(
    Buffer.from(latest.codeHash, "hex"),
    Buffer.from(hash(code), "hex"),
  );
  if (!matches) return latest.attempts + 1 >= CODE_ATTEMPTS ? "too-many" : "wrong";

  // Used up once: if the right code was sent twice at the same moment, only
  // one gets this far.
  const used = await prisma.volunteerCode.deleteMany({ where: { id: latest.id } });
  if (used.count === 0) return "expired";
  await prisma.volunteerCode.deleteMany({ where: { email } });
  return "ok";
}

// Remembers the verified email on this browser. Only call from a Server
// Action, since it sets a cookie.
export async function startSession(email: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.volunteerSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.volunteerSession.create({
      data: { tokenHash: hash(token), email, expiresAt },
    }),
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// The email this browser has verified, or null. cache() dedupes the lookup
// within a request.
export const getVerifiedEmail = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.volunteerSession.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.email;
});

// Forgets the verified email on this browser. Only call from a Server
// Action, since it deletes a cookie.
export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.volunteerSession.deleteMany({ where: { tokenHash: hash(token) } });
  }
  store.delete(COOKIE);
}
