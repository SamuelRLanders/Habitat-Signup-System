import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/dal";

// Wraps every admin page except the login pages, which live outside this
// (dashboard) route group. The parentheses keep "dashboard" out of the URL.
export default async function DashboardLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-semibold">Habitat Admin</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{admin.email}</span>
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
