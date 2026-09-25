import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/auth/redirects";

// Runs before every signed-in-only request. It only checks that a session
// cookie exists, so logged-out visitors are sent to sign in before a page
// renders, and come back afterwards. It doesn't check the cookie is valid or
// who it belongs to: pages do that with requireUser() and requireAdmin().
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(
      new URL(loginPath(pathname + search), request.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  // Admin pages (except the old /admin/login address, which redirects to
  // /login itself) and volunteers' own pages.
  matcher: ["/admin", "/admin/((?!login(?:/|$)).*)", "/me", "/me/:path*"],
};
