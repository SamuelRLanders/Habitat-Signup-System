import "server-only";
import { headers } from "next/headers";

// Details about the current request, for rate limits and waiver records.

// The visitor's IP address, from the header set by the hosting proxy.
// Null when running locally without one.
export async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || null;
}

export async function clientUserAgent() {
  return (await headers()).get("user-agent")?.slice(0, 500) || null;
}

// A full URL to a page on this site, for links in emails.
export function absoluteUrl(path: string) {
  return new URL(path, process.env.BETTER_AUTH_URL).toString();
}
