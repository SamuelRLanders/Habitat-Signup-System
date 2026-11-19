import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from ".";
import { ADMIN_HOME, loginPath } from "./redirects";
import { canEdit, isRole } from "./roles";

// The Data Access Layer: the real authorization check. Call one of the
// require functions at the top of every protected page and Server Action:
//   requireAdmin()  any admin, viewers included: pages, queries, exports
//   requireEditor() editors and the owner: every action that changes data
//   requireOwner()  the owner only: the Admins page and its actions
// The proxy's cookie check (src/proxy.ts) only exists to redirect quickly.

// The signed-in admin, or null. Only admins can sign in, but a session left
// from when volunteers could is treated as signed out. The role is read
// from the database on every request, so a change takes effect at once.
// cache() dedupes the lookup within a request.
export const getAdmin = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  return user && isRole(user.role) ? { ...user, role: user.role } : null;
});

export type Admin = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;

// returnTo is where to come back to after signing in.
export async function requireAdmin(returnTo = "/admin") {
  const admin = await getAdmin();
  if (!admin) redirect(loginPath(returnTo));
  return admin;
}

// Viewers can see everything but change nothing. Their pages hide the
// controls, so this only stops a viewer calling an action some other way,
// or an admin made a viewer while a page was open.
export async function requireEditor() {
  const admin = await requireAdmin();
  if (!canEdit(admin.role)) throw new Error("Viewers can't make changes.");
  return admin;
}

// For pages only editors use, such as editing a form: a viewer who opens
// one is sent to fallback, where they can see the same things.
export async function requireEditorPage(returnTo: string, fallback: string) {
  const admin = await requireAdmin(returnTo);
  if (!canEdit(admin.role)) redirect(fallback);
  return admin;
}

// The owner manages the admins. Anyone else is sent to the admin home.
export async function requireOwner() {
  const admin = await requireAdmin();
  if (admin.role !== "OWNER") redirect(ADMIN_HOME);
  return admin;
}
