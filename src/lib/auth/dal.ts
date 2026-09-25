import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from ".";
import { loginPath } from "./redirects";

// The Data Access Layer: the real authorization check. Call requireUser() or
// requireAdmin() at the top of every protected page and Server Action. The
// proxy's cookie check (src/proxy.ts) only exists to redirect quickly.

// The signed-in user, or null. cache() dedupes the lookup within a request.
export const getUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// returnTo is where to come back to after signing in.
export async function requireUser(returnTo?: string) {
  const user = await getUser();
  if (!user) redirect(loginPath(returnTo));
  return user;
}

// Volunteers who reach an admin page are sent to their own page instead.
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/me");
  return user;
}
