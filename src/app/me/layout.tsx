import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/dal";
import { MeNav } from "./me-nav";

// Wraps the signed-in volunteer's own pages. Each page also calls
// requireUser(), since layouts don't re-run on every navigation.
export default async function MeLayout({ children }: LayoutProps<"/me">) {
  const user = await requireUser("/me");

  return (
    <div className="flex flex-1 flex-col">
      {/* On phones the tabs wrap onto their own row under the title. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3">
        <Link href="/me" className="font-semibold">
          Habitat Volunteer
        </Link>
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <MeNav />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted-foreground md:inline">{user.email}</span>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Admin
            </Link>
          )}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
