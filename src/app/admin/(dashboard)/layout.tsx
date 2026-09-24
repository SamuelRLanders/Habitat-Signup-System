import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminNav } from "./admin-nav";

// Wraps every admin page except the login pages, which live outside this
// (dashboard) route group. The parentheses keep "dashboard" out of the URL.
export default async function DashboardLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      {/* On phones the tabs wrap onto their own row under the title. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3">
        <Link href="/admin" className="font-semibold">
          Habitat Admin
        </Link>
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <AdminNav />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted-foreground md:inline">{admin.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
