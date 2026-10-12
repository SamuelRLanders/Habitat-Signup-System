// Where to send admins after they sign in.

// Stands in for this site when checking where a path leads.
const SITE = "https://this-site.invalid";

// The ?next= value, if it's a path on this site. Anything else (such as
// "https://evil.example" or "//evil.example") is ignored, so a crafted
// sign-in link can't send someone to another site. It's read the way a
// browser will read it, since browsers drop tabs and newlines and treat \
// as /: "/\t/evil.example" looks like a path, but leads to evil.example.
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(next, SITE);
  } catch {
    return null;
  }
  if (url.origin !== SITE) return null;
  return url.pathname + url.search + url.hash;
}

export const ADMIN_HOME = "/admin";

export function loginPath(next?: string) {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
