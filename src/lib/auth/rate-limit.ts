import "server-only";
import { prisma } from "@/lib/prisma";

// Limits on sending sign-in codes, so the form can't be used to flood
// someone's inbox or run up our email bill. Better Auth has its own rate
// limiter, but it only covers its HTTP endpoints, which we don't expose.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const LIMITS = [
  { key: "email", max: 1, window: MINUTE }, // one code per minute...
  { key: "email", max: 5, window: HOUR }, // ...and five per hour per email
  { key: "ipAddress", max: 20, window: HOUR }, // one browser trying many emails
] as const;

// Requests are only needed for the longest window. Older ones are deleted.
const KEEP_FOR = HOUR;

export type CodeLimit = { allowed: true } | { allowed: false; retryAfter: number };

// Checks whether a code can be sent, and if so records the request. On
// refusal, retryAfter is the number of seconds until one can be sent.
export async function takeLoginCodeRequest(
  email: string,
  ipAddress: string | null,
): Promise<CodeLimit> {
  const now = Date.now();
  await prisma.loginCodeRequest.deleteMany({
    where: { createdAt: { lt: new Date(now - KEEP_FOR) } },
  });

  let retryAfter = 0;
  for (const limit of LIMITS) {
    const value = limit.key === "email" ? email : ipAddress;
    if (!value) continue;

    // The oldest request that still counts against the limit. Once it falls
    // out of the window, there's room for another.
    const recent = await prisma.loginCodeRequest.findMany({
      where: {
        ...(limit.key === "email" ? { email: value } : { ipAddress: value }),
        createdAt: { gte: new Date(now - limit.window) },
      },
      orderBy: { createdAt: "desc" },
      take: limit.max,
      select: { createdAt: true },
    });
    if (recent.length >= limit.max) {
      const freesAt = recent[limit.max - 1].createdAt.getTime() + limit.window;
      retryAfter = Math.max(retryAfter, Math.ceil((freesAt - now) / 1000));
    }
  }
  if (retryAfter > 0) return { allowed: false, retryAfter };

  await prisma.loginCodeRequest.create({ data: { email, ipAddress } });
  return { allowed: true };
}

// Seconds until the one-per-minute limit allows another code, shown as the
// "resend" countdown after a code is sent.
export const RESEND_AFTER_SECONDS = MINUTE / 1000;
