import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Limits on the emails anyone can set off, so the public forms can't be
// used to flood someone's inbox or use up the day's emails (see
// src/lib/email.ts): codes for admin sign-in and for volunteers confirming
// their email (one shared count per address). Better Auth has its own rate
// limiter, but it only covers its HTTP endpoints, which we don't expose.
//
// Each check counts recent emails and records the new one while holding a
// lock, so requests sent at the same moment can't all be counted before any
// is recorded. A request that finds the lock taken is refused rather than
// waiting: another request for the same email (or from the same IP address)
// is being handled right then.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Takes a lock that's held until the transaction ends, or returns false if
// another transaction holds it. Keys are hashed into Postgres's advisory
// lock numbers; two keys sharing a number only means they take turns.
async function tryLock(tx: Prisma.TransactionClient, key: string) {
  const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
  return locked;
}

// The seconds until there's room under each limit, given the createdAt of
// recent requests, newest first: 0 if there's room now.
function waitFor(recent: Date[], max: number, window: number, now: number) {
  if (recent.length < max) return 0;
  // The oldest request that still counts against the limit. Once it falls
  // out of the window, there's room for another.
  const freesAt = recent[max - 1].getTime() + window;
  return Math.max(Math.ceil((freesAt - now) / 1000), 0);
}

// ─── Emailed codes ───────────────────────────────────────────────────────────

const CODE_LIMITS = [
  { key: "email", max: 1, window: MINUTE }, // one code per minute...
  { key: "email", max: 5, window: HOUR }, // ...and five per hour per email
  // One browser trying many emails. Students on campus Wi-Fi may share an
  // address, so this leaves room for several of them.
  { key: "ipAddress", max: 15, window: HOUR },
] as const;

// Requests are only needed for the longest window. Older ones are deleted.
const KEEP_CODES_FOR = HOUR;

// On refusal, retryAfter is the number of seconds until a code can be
// sent, and busy means another request from the same IP address was being
// handled at that moment, so trying again shortly may work.
export type CodeLimit =
  | { allowed: true }
  | { allowed: false; retryAfter: number; busy?: true };

// Checks whether a code can be sent, and if so records the request.
export async function takeLoginCodeRequest(
  email: string,
  ipAddress: string | null,
): Promise<CodeLimit> {
  const now = Date.now();
  await prisma.loginCodeRequest.deleteMany({
    where: { createdAt: { lt: new Date(now - KEEP_CODES_FOR) } },
  });

  return prisma.$transaction(async (tx): Promise<CodeLimit> => {
    // Another request for this email is sending it a code right now.
    if (!(await tryLock(tx, `code-email:${email}`))) {
      return { allowed: false, retryAfter: RESEND_AFTER_SECONDS };
    }
    if (ipAddress && !(await tryLock(tx, `code-ip:${ipAddress}`))) {
      return { allowed: false, retryAfter: 5, busy: true };
    }

    let retryAfter = 0;
    for (const limit of CODE_LIMITS) {
      const value = limit.key === "email" ? email : ipAddress;
      if (!value) continue;
      const recent = await tx.loginCodeRequest.findMany({
        where: {
          ...(limit.key === "email" ? { email: value } : { ipAddress: value }),
          createdAt: { gte: new Date(now - limit.window) },
        },
        orderBy: { createdAt: "desc" },
        take: limit.max,
        select: { createdAt: true },
      });
      const createdAt = recent.map((request) => request.createdAt);
      retryAfter = Math.max(retryAfter, waitFor(createdAt, limit.max, limit.window, now));
    }
    if (retryAfter > 0) return { allowed: false, retryAfter };

    await tx.loginCodeRequest.create({ data: { email, ipAddress } });
    return { allowed: true };
  });
}

// Seconds until the one-per-minute limit allows another code, shown as the
// "resend" countdown after a code is sent.
export const RESEND_AFTER_SECONDS = MINUTE / 1000;
