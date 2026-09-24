import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from ".";

// The Data Access Layer: the real authorization check. Call requireAdmin() at
// the top of every admin page and every admin Server Action. The proxy's
// cookie check (src/proxy.ts) only exists to redirect quickly.

// The logged-in admin, or null. cache() dedupes the lookup within a request.
export const getAdmin = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
