import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every admin request. It only checks that a session cookie
// exists, so logged-out visitors are redirected before a page renders. It
// doesn't check the cookie is valid: pages do that with requireAdmin().
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // All admin pages except /admin/login and /admin/login/verify.
  matcher: ["/admin", "/admin/((?!login(?:/|$)).*)"],
};
