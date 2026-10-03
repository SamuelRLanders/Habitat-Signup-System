import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from ".";
import { loginPath } from "./redirects";

// The Data Access Layer: the real authorization check. Call requireAdmin()
// at the top of every protected page and Server Action. The proxy's cookie
// check (src/proxy.ts) only exists to redirect quickly.

// The signed-in admin, or null. Only admins can sign in, but a session left
// from when volunteers could is treated as signed out. cache() dedupes the
// lookup within a request.
export const getAdmin = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  return user?.role === "ADMIN" ? user : null;
});

// returnTo is where to come back to after signing in.
export async function requireAdmin(returnTo = "/admin") {
  const admin = await getAdmin();
  if (!admin) redirect(loginPath(returnTo));
  return admin;
}
