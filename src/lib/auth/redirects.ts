// Where to send people after they sign in.

// The ?next= value, if it's a path on this site. Anything else (such as
// "https://evil.example" or "//evil.example") is ignored, so a crafted
// sign-in link can't send someone to another site.
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

export function homePath(role: string) {
  return role === "ADMIN" ? "/admin" : "/me";
}

export function loginPath(next?: string) {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
